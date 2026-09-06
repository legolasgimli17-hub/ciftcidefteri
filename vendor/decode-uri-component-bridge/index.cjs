'use strict';

const decoderModule = require('decode-uri-component-safe');
const decodeUriComponent = decoderModule.default ?? decoderModule;

if (typeof decodeUriComponent !== 'function') {
  throw new TypeError('Safe URI decoder bridge could not load a callable decoder.');
}

module.exports = decodeUriComponent;
