interface Env {
  PORT: number;
}

export const env: Env = {
  PORT: parseInt(process.env['PORT'] || '3000', 10),
};
