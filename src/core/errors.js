function 输入错误(message, status = 400) { return Object.assign(new Error(message), { status }); }

export { 输入错误 };
