jest.mock('../server/services/intentClassifierService', () => ({
    classifyKeywordFlowIntent: jest.fn(),
    classifyIntentRoute: jest.fn()
}));

const intentClassifier = require('../server/services/intentClassifierService');
const flowService = require('../server/services/flowService');
const { FlowService } = require('../server/services/flowService');

describe('FlowService intent routing', () => {
    const execution = { triggerMessageText: '', variables: {} };

    beforeEach(() => {
        intentClassifier.classifyIntentRoute.mockReset();
        intentClassifier.classifyKeywordFlowIntent.mockReset();
        delete process.env.FLOW_INTENT_CLASSIFIER_STRICT;
        delete process.env.FLOW_INTENT_CLASSIFIER_ENABLED;
        delete process.env.GEMINI_API_KEY;
    });

    test('uses local fallback for intent node when semantic returns no_match', async () => {
        intentClassifier.classifyIntentRoute.mockResolvedValue({
            status: 'no_match',
            confidence: 0.99,
            reason: 'mock'
        });

        const node = {
            type: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-showroom', label: 'showroom', phrases: 'ok obrigado' },
                    { id: 'route-hours', label: 'duvida horario', phrases: 'Qual horario eu posso ir?' }
                ]
            }
        };

        const selected = await flowService.pickTriggerIntentHandle(execution, node, 'Que horas posso ir?');
        expect(selected).toBe('route-hours');
    });

    test('matches horario intent with canonicalized hour token', async () => {
        intentClassifier.classifyIntentRoute.mockResolvedValue(null);

        const node = {
            type: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-hours', label: 'duvida horario', phrases: 'Qual horario eu posso ir?' }
                ]
            }
        };

        const selected = await flowService.pickTriggerIntentHandle(execution, node, 'Que horas posso ir?');
        expect(selected).toBe('route-hours');
    });

    test('keeps strict behavior for trigger node when semantic returns no_match', async () => {
        process.env.FLOW_INTENT_CLASSIFIER_STRICT = '1';
        process.env.GEMINI_API_KEY = 'mock-key';

        intentClassifier.classifyIntentRoute.mockResolvedValue({
            status: 'no_match',
            confidence: 0.92,
            reason: 'mock'
        });

        const node = {
            type: 'trigger',
            subtype: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-hours', label: 'duvida horario', phrases: 'Qual horario eu posso ir?' }
                ]
            }
        };

        const selected = await flowService.pickTriggerIntentHandle(execution, node, 'Que horas posso ir?');
        expect(selected).toBeNull();
    });
});

describe('FlowService intent routing compatibility', () => {
    test('continueFlow treats trigger keyword node as intent routing node', async () => {
        const service = new FlowService();
        const node = {
            id: 'trigger-mid',
            type: 'trigger',
            subtype: 'keyword',
            data: {
                intentRoutes: [
                    { id: 'route-buy', label: 'Comprar', phrases: 'comprar' }
                ]
            }
        };

        const execution = {
            id: 999,
            flow: { id: 1, nodes: [node], edges: [] },
            conversation: { id: 11 },
            currentNode: 'trigger-mid',
            variables: {}
        };

        const pickSpy = jest.spyOn(service, 'pickTriggerIntentHandle').mockResolvedValue('route-buy');
        const goToNextSpy = jest.spyOn(service, 'goToNextNode').mockResolvedValue();

        await service.continueFlow(execution, { text: 'comprar agora' });

        expect(pickSpy).toHaveBeenCalledWith(execution, node, 'comprar agora');
        expect(goToNextSpy).toHaveBeenCalledWith(execution, node, 'route-buy');

        pickSpy.mockRestore();
        goToNextSpy.mockRestore();
    });

    test('goToNextNode falls back to edge label when sourceHandle is stale', async () => {
        const service = new FlowService();
        const currentNode = {
            id: 'intent-mid',
            type: 'intent',
            data: {
                intentRoutes: [
                    { id: 'route-buy', label: 'Intenção 1', phrases: 'comprar roupa' },
                    { id: 'route-store', label: 'Intenção 2', phrases: 'onde fica a loja' }
                ]
            }
        };

        const execution = {
            flow: {
                id: 11,
                edges: [
                    {
                        source: 'intent-mid',
                        target: 'message-buy',
                        sourceHandle: 'legacy-route-id-a',
                        label: 'Intenção 1'
                    },
                    {
                        source: 'intent-mid',
                        target: 'message-store',
                        sourceHandle: 'legacy-route-id-b',
                        label: 'Intenção 2'
                    }
                ]
            },
            conversation: { id: 77 }
        };

        const executeSpy = jest.spyOn(service, 'executeNode').mockResolvedValue();
        const endSpy = jest.spyOn(service, 'endFlow').mockResolvedValue();

        await service.goToNextNode(execution, currentNode, 'route-buy');

        expect(executeSpy).toHaveBeenCalledWith(execution, 'message-buy');
        expect(endSpy).not.toHaveBeenCalled();

        executeSpy.mockRestore();
        endSpy.mockRestore();
    });
});
