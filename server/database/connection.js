/**
 * SELF PROTEÇÃO VEICULAR - Conexão com Banco de Dados
 * Módulo de conexão SQLite com better-sqlite3
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Diretório de dados
const DEFAULT_DATA_DIR = path.join(__dirname, '..', '..', 'data');
let DATA_DIR = process.env.DATA_DIR || DEFAULT_DATA_DIR;

function ensureDir(targetDir, fallbackDir, label) {
    try {
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        return targetDir;
    } catch (error) {
        const fallback = fallbackDir || targetDir;
        console.warn(`[Warn] Could not create ${label} dir at ${targetDir}: ${error.message}`);
        if (!fs.existsSync(fallback)) {
            fs.mkdirSync(fallback, { recursive: true });
        }
        return fallback;
    }
}

DATA_DIR = ensureDir(DATA_DIR, DEFAULT_DATA_DIR, 'data');

// Caminho do banco de dados
const DEFAULT_DB_PATH = path.join(DEFAULT_DATA_DIR, 'self.db');
let DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'self.db');
try {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
} catch (error) {
    console.warn(`[Warn] Could not create database dir for ${DB_PATH}: ${error.message}`);
    DB_PATH = DEFAULT_DB_PATH;
}

// Instância do banco de dados
let db = null;

/**
 * Inicializar conexão com o banco de dados
 */
function getDatabase() {
    if (db) return db;
    
    try {
        db = new Database(DB_PATH, {
            verbose: process.env.NODE_ENV === 'development' ? console.log : null
        });
        
        // Configurações de performance
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');
        db.pragma('cache_size = 10000');
        db.pragma('temp_store = MEMORY');
        db.pragma('foreign_keys = ON');
        
        console.log(`📦 Banco de dados conectado: ${DB_PATH}`);
        
        return db;
    } catch (error) {
        console.error('❌ Erro ao conectar ao banco de dados:', error.message);
        throw error;
    }
}

/**
 * Executar query com parâmetros
 */
function query(sql, params = []) {
    const database = getDatabase();
    return database.prepare(sql).all(...params);
}

/**
 * Executar query que retorna uma única linha
 */
function queryOne(sql, params = []) {
    const database = getDatabase();
    return database.prepare(sql).get(...params);
}

/**
 * Executar INSERT/UPDATE/DELETE
 */
function run(sql, params = []) {
    const database = getDatabase();
    return database.prepare(sql).run(...params);
}

/**
 * Executar múltiplas queries em uma transação
 */
function transaction(callback) {
    const database = getDatabase();
    return database.transaction(callback)();
}

/**
 * Fechar conexão
 */
function close() {
    if (db) {
        db.close();
        db = null;
        console.log('📦 Conexão com banco de dados fechada');
    }
}

/**
 * Verificar se tabela existe
 */
function tableExists(tableName) {
    const result = queryOne(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [tableName]
    );
    return !!result;
}

/**
 * Gerar UUID v4
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

module.exports = {
    getDatabase,
    query,
    queryOne,
    run,
    transaction,
    close,
    tableExists,
    generateUUID,
    DB_PATH
};
