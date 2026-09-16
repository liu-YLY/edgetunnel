let connector = () => { throw new Error('Test socket connector was not configured'); };
export function setSocketConnector(value) { connector = value; }
export function connect(...args) { return connector(...args); }
