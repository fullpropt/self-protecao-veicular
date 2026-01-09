/**
 * SELF PROTEÇÃO VEICULAR - Script de Migração
 * Executa o esquema SQL para criar/atualizar tabelas
 */

const fs = require('fs');
const path = require('path');
const { getDatabase, close } = require('./connection');

function migrate() {
    console.log('🔄 Iniciando migração do banco de dados...');
    
    let db = null;
    
    try {
        db = getDatabase();
        
        // Ler arquivo de esquema
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Remover comentários de linha e normalizar
        const cleanedSchema = schema
            .split('\n')
            .map(line => {
                // Remover comentários de linha
                const commentIndex = line.indexOf('--');
                if (commentIndex !== -1) {
                    return line.substring(0, commentIndex);
                }
                return line;
            })
            .join('\n');
        
        // Dividir em statements individuais
        const statements = cleanedSchema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;
        
        console.log(`📋 Executando ${statements.length} statements...`);
        
        for (const statement of statements) {
            try {
                db.exec(statement + ';');
                successCount++;
                
                // Log para tabelas criadas
                if (statement.toUpperCase().includes('CREATE TABLE')) {
                    const match = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
                    if (match) {
                        console.log(`   ✓ Tabela ${match[1]} criada`);
                    }
                }
            } catch (error) {
                if (error.message.includes('already exists') || 
                    error.message.includes('UNIQUE constraint')) {
                    skipCount++;
                } else {
                    console.error(`   ✗ Erro: ${error.message}`);
                    console.error(`     Statement: ${statement.substring(0, 100)}...`);
                    errorCount++;
                }
            }
        }
        
        console.log('');
        console.log(`✅ Migração concluída!`);
        console.log(`   - Executados: ${successCount}`);
        console.log(`   - Ignorados (já existem): ${skipCount}`);
        if (errorCount > 0) {
            console.log(`   - Erros: ${errorCount}`);
        }
        
        // Verificar tabelas criadas
        const tables = db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
            ORDER BY name
        `).all();
        
        console.log('');
        console.log(`📋 Tabelas no banco de dados (${tables.length}):`);
        tables.forEach(t => console.log(`   - ${t.name}`));
        
        return true;
    } catch (error) {
        console.error('❌ Erro fatal na migração:', error.message);
        return false;
    } finally {
        if (db) {
            close();
        }
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const success = migrate();
    process.exit(success ? 0 : 1);
}

module.exports = { migrate };
