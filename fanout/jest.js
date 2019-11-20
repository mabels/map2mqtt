module.exports = {
  testEnvironment: "node",
  preset: "ts-jest",
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  testRegex: 'src/.*(\\.)test\\.tsx?$',
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json',
    'node'
  ]
};
