module.exports = {
  extends: ["./packages/config/eslint/base.cjs"],
  overrides: [
    {
      files: ["apps/identity/**/*", "packages/db/**/*"],
      rules: {
        "no-restricted-imports": "off"
      }
    }
  ]
};
