module.exports = {
  ci: {
    collect: {
      url: [process.env.PORTAL_LIGHTHOUSE_URL || "http://localhost:3000"],
      numberOfRuns: 1,
      settings: {
        preset: "desktop",
        emulatedFormFactor: "desktop",
        disableStorageReset: true
      }
    },
    assert: {
      preset: "lighthouse:recommended",
      assertions: {
        "largest-contentful-paint": ["warn", { maxNumericValue: 2500, aggregationMethod: "median" }],
        "first-contentful-paint": ["warn", { maxNumericValue: 1800, aggregationMethod: "median" }],
        "uses-responsive-images": "warn"
      }
    },
    upload: {
      target: "temporary-public-storage"
    }
  }
};
