/**
 * STARK AI Sub-Agent Entrypoint: test_sub_agent_mvo6chd7
 */

const fs = require('fs');
const path = require('path');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'agentConfig.json'), 'utf8'));

class Agent {
  constructor() {
    this.name = config.name;
    this.permissions = config.permissions;
  }

  async processQuery(userInput) {
    if (!userInput || String(userInput).trim().length === 0) {
      throw new Error('User input cannot be empty.');
    }
    return {
      agent: this.name,
      reply: "Acknowledged: " + userInput,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { Agent, agentInstance: new Agent() };
