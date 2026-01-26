import { MCPServerEnhanced, TOOL_DEFINITIONS } from '../../mcp/server';

describe('Phase 1 Integration Tests', () => {
  describe('MCP Server Integration', () => {
    let server: MCPServerEnhanced;

    beforeEach(() => {
      server = MCPServerEnhanced.getInstance();
    });

    it('should register default tools on initialization', () => {
      const tools = server.getAllTools();
      expect(Object.keys(tools).length).toBeGreaterThanOrEqual(4);
      expect(tools['create_task_sandbox']).toBeDefined();
      expect(tools['attach_agent_to_task']).toBeDefined();
      expect(tools['detach_agent_from_task']).toBeDefined();
      expect(tools['execute_in_task']).toBeDefined();
    });

    it('should retrieve registered tool', () => {
      const tool = server.getTool('create_task_sandbox');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('create_task_sandbox');
      expect(tool!.description).toContain('Docker container');
    });

    it('should return undefined for non-existent tool', () => {
      const tool = server.getTool('non_existent_tool');
      expect(tool).toBeUndefined();
    });

    it('should have tool definitions export', () => {
      expect(TOOL_DEFINITIONS).toBeDefined();
      expect(TOOL_DEFINITIONS.length).toBe(4);
      expect(TOOL_DEFINITIONS[0].name).toBe('create_task_sandbox');
    });

    it('should handle tool execution interface', async () => {
      const tool = server.getTool('create_task_sandbox');
      expect(tool).toBeDefined();
      
      const result = await tool!.execute({ taskId: 'test-task' });
      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(result.taskId).toBe('test-task');
    });
  });

  describe('Tool Interface Contracts', () => {
    it('should have execute function on all tools', () => {
      TOOL_DEFINITIONS.forEach(tool => {
        expect(tool.execute).toBeDefined();
        expect(typeof tool.execute).toBe('function');
      });
    });

    it('should have name and description on all tools', () => {
      TOOL_DEFINITIONS.forEach(tool => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
      });
    });

    it('should return Promise from execute', async () => {
      const tool = TOOL_DEFINITIONS[0];
      const result = tool.execute({});
      expect(result).toBeInstanceOf(Promise);
    });
  });
});
