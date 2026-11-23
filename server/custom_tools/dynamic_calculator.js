/**
 * VISION AI Dynamic Tool: Dynamic Calculator
 */
module.exports = {
  execute: async function(args = {}) {
    const a = Number(args.a || 0);
    const b = Number(args.b || 0);
    const op = String(args.op || 'add').toLowerCase();
    let result = 0;
    if (op === 'add') result = a + b;
    else if (op === 'multiply') result = a * b;
    else if (op === 'subtract') result = a - b;
    else if (op === 'divide') result = b !== 0 ? a / b : null;
    return {
      success: true,
      a,
      b,
      operation: op,
      result,
      summary: "Result: " + result
    };
  }
};
