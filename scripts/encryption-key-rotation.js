#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const { Client } = require('pg');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const DEFAULT_BATCH_SIZE = 500;

function readEnv(name, fallback = '') {
    return String(process.env[name] || fallback || '').trim();
}

function parseBatchSize(rawValue) {
    const value = Number.parseInt(String(rawValue || DEFAULT_BATCH_SIZE), 10);
    if (!Number.isFinite(value) || value < 50 || value > 5000) {
        return DEFAULT_BATCH_SIZE;
    }
    return value;
}

function getMode() {
    const mode = String(process.argv[2] || 'audit').trim().toLowerCase();
    if (mode !== 'audit' && mode !== 'migrate') {
        throw new Error('Modo inválido. Use "audit" ou "migrate".');
    }
    return mode;
}

function requireEnv(name) {
    const value = readEnv(name);
    if (!value) {
        throw new Error(`${name} não configurada.`);
    }
    return value;
}

function getEncryptionKeyFromMaster(masterKey) {
    return crypto.createHash('sha256').update(String(masterKey || '')).digest();
}

function encryptWithMaster(plaintext, masterKey) {
    const value = String(plaintext || '');
    if (!value) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getEncryptionKeyFromMaster(masterKey);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(value, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

function decryptAesGcm(ciphertext, masterKey) {
    const serialized = String(ciphertext || '');
    const parts = serialized.split(':');
    if (parts.length !== 3) return null;

    const [ivBase64, authTagBase64, encrypted] = parts;
    const key = getEncryptionKeyFromMaster(masterKey);
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

function decryptLegacyCryptoJs(ciphertext, masterKey) {
    const bytes = CryptoJS.AES.decrypt(String(ciphertext || ''), String(masterKey || ''));
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || null;
}

function isAesGcmPayload(ciphertext) {
    const serialized = String(ciphertext || '');
    return serialized.split(':').length === 3;
}

function tryDecrypt(ciphertext, masterKey) {
    if (!ciphertext || !masterKey) return null;
    const serialized = String(ciphertext || '');
    const aesPayload = isAesGcmPayload(serialized);

    if (aesPayload) {
        try {
            const aes = decryptAesGcm(serialized, masterKey);
            if (aes !== null && aes !== undefined) return aes;
        } catch (_) {}
        return null;
    }

    try {
        return decryptLegacyCryptoJs(serialized, masterKey);
    } catch (_) {
        return null;
    }
}

function classifyCiphertext(ciphertext, currentMasterKey, previousMasterKey) {
    const plaintextCurrent = tryDecrypt(ciphertext, currentMasterKey);
    if (plaintextCurrent !== null && plaintextCurrent !== undefined) {
        return { owner: 'current', plaintext: plaintextCurrent };
    }

    if (previousMasterKey) {
        const plaintextPrevious = tryDecrypt(ciphertext, previousMasterKey);
        if (plaintextPrevious !== null && plaintextPrevious !== undefined) {
            return { owner: 'previous', plaintext: plaintextPrevious };
        }
    }

    return { owner: 'invalid', plaintext: null };
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function migrateMessages(client, context) {
    const stats = {
        total: 0,
        scanned: 0,
        decryptCurrent: 0,
        decryptPreviousOnly: 0,
        invalid: 0,
        migrated: 0,
        previousLegacySkipped: 0
    };

    const totalResult = await client.query(
        "SELECT COUNT(*)::int AS total FROM messages WHERE COALESCE(content_encrypted, '') <> ''"
    );
    stats.total = Number(totalResult.rows?.[0]?.total || 0);

    let lastId = 0;
    while (true) {
        const result = await client.query(
            "SELECT id, content_encrypted FROM messages WHERE id > $1 AND COALESCE(content_encrypted, '') <> '' ORDER BY id ASC LIMIT $2",
            [lastId, context.batchSize]
        );
        const rows = result.rows || [];
        if (rows.length === 0) break;

        const updates = [];
        for (const row of rows) {
            const id = Number(row.id);
            lastId = id;
            stats.scanned += 1;

            const classification = classifyCiphertext(
                row.content_encrypted,
                context.currentMasterKey,
                context.previousMasterKey
            );

            if (classification.owner === 'current') {
                stats.decryptCurrent += 1;
                continue;
            }

            if (classification.owner === 'previous') {
                stats.decryptPreviousOnly += 1;
                if (context.mode === 'migrate' && isAesGcmPayload(row.content_encrypted)) {
                    const reencrypted = encryptWithMaster(classification.plaintext, context.currentMasterKey);
                    if (reencrypted) {
                        updates.push({ id, contentEncrypted: reencrypted });
                    }
                } else if (context.mode === 'migrate') {
                    stats.previousLegacySkipped += 1;
                }
                continue;
            }

            stats.invalid += 1;
        }

        if (updates.length > 0) {
            await client.query('BEGIN');
            try {
                for (const updateItem of updates) {
                    await client.query(
                        'UPDATE messages SET content_encrypted = $1 WHERE id = $2',
                        [updateItem.contentEncrypted, updateItem.id]
                    );
                }
                await client.query('COMMIT');
                stats.migrated += updates.length;
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
        }
    }

    return stats;
}

function visitEncryptedFields(node, visit) {
    if (Array.isArray(node)) {
        for (let index = 0; index < node.length; index += 1) {
            const value = node[index];
            if (isPlainObject(value) || Array.isArray(value)) {
                visitEncryptedFields(value, visit);
            }
        }
        return;
    }

    if (!isPlainObject(node)) return;

    for (const [key, value] of Object.entries(node)) {
        if (typeof value === 'string' && /encrypted$/i.test(String(key || '').trim())) {
            visit(node, key, value);
            continue;
        }

        if (isPlainObject(value) || Array.isArray(value)) {
            visitEncryptedFields(value, visit);
        }
    }
}

async function migrateSettings(client, context) {
    const stats = {
        rowsScanned: 0,
        encryptedFields: 0,
        decryptCurrent: 0,
        decryptPreviousOnly: 0,
        invalid: 0,
        migratedRows: 0,
        migratedFields: 0,
        previousLegacySkipped: 0
    };

    const result = await client.query(
        "SELECT key, value, type FROM settings WHERE type = 'json' AND COALESCE(value, '') <> ''"
    );
    const rows = result.rows || [];

    for (const row of rows) {
        stats.rowsScanned += 1;
        let parsed;
        try {
            parsed = JSON.parse(String(row.value || ''));
        } catch (_) {
            continue;
        }

        let changed = false;
        visitEncryptedFields(parsed, (targetObject, fieldKey, encryptedValue) => {
            if (!String(encryptedValue || '').trim()) return;
            stats.encryptedFields += 1;

            const classification = classifyCiphertext(
                encryptedValue,
                context.currentMasterKey,
                context.previousMasterKey
            );

            if (classification.owner === 'current') {
                stats.decryptCurrent += 1;
                return;
            }

            if (classification.owner === 'previous') {
                stats.decryptPreviousOnly += 1;
                if (context.mode === 'migrate' && isAesGcmPayload(encryptedValue)) {
                    const reencrypted = encryptWithMaster(classification.plaintext, context.currentMasterKey);
                    if (reencrypted) {
                        targetObject[fieldKey] = reencrypted;
                        changed = true;
                        stats.migratedFields += 1;
                    }
                } else if (context.mode === 'migrate') {
                    stats.previousLegacySkipped += 1;
                }
                return;
            }

            stats.invalid += 1;
        });

        if (changed) {
            await client.query(
                'UPDATE settings SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = $2',
                [JSON.stringify(parsed), row.key]
            );
            stats.migratedRows += 1;
        }
    }

    return stats;
}

function printStats(mode, stats) {
    console.log('=== ROTATION CHECK ===');
    console.log(`MODE: ${mode}`);
    console.log('');
    console.log('[messages]');
    console.log(`total=${stats.messages.total}`);
    console.log(`scanned=${stats.messages.scanned}`);
    console.log(`decrypt_current=${stats.messages.decryptCurrent}`);
    console.log(`decrypt_previous_only=${stats.messages.decryptPreviousOnly}`);
    console.log(`invalid=${stats.messages.invalid}`);
    console.log(`migrated=${stats.messages.migrated}`);
    console.log(`previous_legacy_skipped=${stats.messages.previousLegacySkipped}`);
    console.log('');
    console.log('[settings]');
    console.log(`rows_scanned=${stats.settings.rowsScanned}`);
    console.log(`encrypted_fields=${stats.settings.encryptedFields}`);
    console.log(`decrypt_current=${stats.settings.decryptCurrent}`);
    console.log(`decrypt_previous_only=${stats.settings.decryptPreviousOnly}`);
    console.log(`invalid=${stats.settings.invalid}`);
    console.log(`migrated_rows=${stats.settings.migratedRows}`);
    console.log(`migrated_fields=${stats.settings.migratedFields}`);
    console.log(`previous_legacy_skipped=${stats.settings.previousLegacySkipped}`);
    console.log('');

    const previousOnlyTotal = stats.messages.decryptPreviousOnly + stats.settings.decryptPreviousOnly;
    const invalidTotal = stats.messages.invalid + stats.settings.invalid;
    console.log(`[summary] previous_only=${previousOnlyTotal} invalid=${invalidTotal}`);
}

async function main() {
    const mode = getMode();
    const context = {
        mode,
        batchSize: parseBatchSize(process.env.ROTATION_BATCH_SIZE),
        databaseUrl: requireEnv('DATABASE_URL'),
        currentMasterKey: requireEnv('ENCRYPTION_KEY'),
        previousMasterKey: readEnv('ENCRYPTION_KEY_PREVIOUS')
    };

    if (!context.previousMasterKey) {
        throw new Error('ENCRYPTION_KEY_PREVIOUS não configurada. Não há fallback para auditar/migrar.');
    }
    if (context.previousMasterKey === context.currentMasterKey) {
        throw new Error('ENCRYPTION_KEY_PREVIOUS não pode ser igual a ENCRYPTION_KEY.');
    }

    const client = new Client({
        connectionString: context.databaseUrl,
        ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    try {
        const messages = await migrateMessages(client, context);
        const settings = await migrateSettings(client, context);
        printStats(mode, { messages, settings });
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error(`rotation-script-error: ${error.message}`);
    process.exit(1);
});
