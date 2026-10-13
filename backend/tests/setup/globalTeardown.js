module.exports = async () => {
  if (globalThis.__EMBEDDED_PG__) await globalThis.__EMBEDDED_PG__.stop();
};
