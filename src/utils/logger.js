export const logger = {
  info(message, meta) {
    if (meta) {
      console.log(message, meta);
      return;
    }
    console.log(message);
  },
  error(message, meta) {
    if (meta) {
      console.error(message, meta);
      return;
    }
    console.error(message);
  }
};
