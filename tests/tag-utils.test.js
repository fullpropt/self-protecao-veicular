const {
    normalizeTagKey,
    parseTagList,
    uniqueTagLabels,
    normalizeTagFilterInput
} = require('../server/utils/tagUtils');

describe('tagUtils', () => {
    test('parseTagList aceita array JSON em string', () => {
        expect(parseTagList('["VIP","  Cliente Novo  "]')).toEqual(['VIP', 'Cliente Novo']);
    });

    test('parseTagList usa delimitadores legados', () => {
        expect(parseTagList('vip;quente|retorno, lead')).toEqual(['vip', 'quente', 'retorno', 'lead']);
    });

    test('uniqueTagLabels remove duplicados por case e acento', () => {
        expect(uniqueTagLabels(['Água', 'agua', ' AGUA ', 'Água com gás'])).toEqual(['Água', 'Água com gás']);
    });

    test('normalizeTagKey remove acentos e normaliza caixa', () => {
        expect(normalizeTagKey('  Pró-Médico  ')).toBe('pro-medico');
    });

    test('normalizeTagFilterInput preserva undefined e normaliza vazios', () => {
        expect(normalizeTagFilterInput(undefined)).toBeUndefined();
        expect(normalizeTagFilterInput('')).toBeNull();
    });

    test('normalizeTagFilterInput retorna JSON deduplicado', () => {
        expect(normalizeTagFilterInput('vip;VIP;víp')).toBe(JSON.stringify(['vip']));
    });
});
