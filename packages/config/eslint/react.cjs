const base = require("./base.cjs");

module.exports = {
  ...base,
  env: {
    ...base.env,
    browser: true
  },
  parserOptions: {
    ...base.parserOptions,
    ecmaFeatures: {
      jsx: true
    }
  },
  plugins: [...new Set([...base.plugins, "react", "react-hooks", "jsx-a11y", "tailwindcss"])],
  extends: [
    ...new Set([
      ...base.extends,
      "plugin:react/recommended",
      "plugin:react-hooks/recommended",
      "plugin:jsx-a11y/recommended",
      "plugin:tailwindcss/recommended"
    ])
  ],
  settings: {
    ...base.settings,
    react: {
      version: "detect"
    }
  },
  rules: {
    "react/react-in-jsx-scope": "off"
  }
};
