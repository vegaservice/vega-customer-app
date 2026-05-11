module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    '@react-native-firebase/firestore': '<rootDir>/__mocks__/firebase-firestore.js',
    '@react-native-firebase/auth': '<rootDir>/__mocks__/firebase-auth.js',
    '@react-native-firebase/messaging': '<rootDir>/__mocks__/firebase-messaging.js',
  },
  testPathPattern: '__tests__',
  collectCoverageFrom: ['*.js', '!App.js', '!jest.config.js'],
};
