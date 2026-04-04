export const feature = (name: string): boolean => {
  return process.env[name] === '1';
};
