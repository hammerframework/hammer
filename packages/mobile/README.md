# Mobile

## Purpose and vision

Redwood's side-based architecture can span to platforms like mobile where apps can be developed in Javascript with a framework like React Native. Unlike the traditional developer experience where the API code lives in a different repository and is usually written in a different programming language, Redwood allows a better experience where the API and the mobile side can be developed alongside.

This package represents the mobile side and provides all the building blocks and abstractions to integrate the React Native development experience into Redwood's. Internally, it uses existing tools like the official [React Native CLI](https://github.com/react-native-community/cli), [the Metro bundler](https://github.com/facebook/metro), and [Babel](https://babeljs.io/), but providing certain defaults to minimize the configuration surface, which leads to more seamless updates and a better integration with the framework.


## Contributing

`@redwoodjs/mobile` uses a few things you should be familiar with:

- [React Native CLI](https://github.com/react-native-community/cli)
- [Metro](https://github.com/facebook/metro)
- [Babel](https://babeljs.io/)