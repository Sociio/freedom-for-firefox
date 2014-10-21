var testUtil = require('freedom/spec/util');
var setup = function () {
  var self = Components.stack.filename;
  var base = self.substr(0, self.lastIndexOf('/'));
  testUtil.setSpecBase(base);
  testUtil.setCoreProviders([
    require('freedom/providers/core/core.unprivileged'),
    require('freedom/providers/core/logger.console'),
    require('freedom/providers/core/peerconnection.unprivileged'),
    require('freedom/providers/core/websocket.unprivileged'),
    require('../providers/core.storage')
  ]);
  testUtil.setModuleStrategy(require('freedom/src/link/worker'), './freedom-for-firefox.jsm');
};

describe("integration-single: social.loopback.json",
    require('freedom/spec/providers/social/social.single.integration.src').bind(this,
    "providers/social/loopback/social.loopback.json", setup));
describe("integration-single: social.ws.json",
    require('freedom/spec/providers/social/social.single.integration.src').bind(this,
    "providers/social/websocket-server/social.ws.json", setup));
describe("integration-double: social.ws.json",
    require('freedom/spec/providers/social/social.double.integration.src').bind(this,
    "providers/social/websocket-server/social.ws.json", setup));

var isolated = "providers/storage/isolated/storage.isolated.json";
describe("integration: storage.isolated.json",
    require('freedom/spec/providers/storage/storage.integration.src').bind(this, isolated, setup));
var shared = "providers/storage/shared/storage.shared.json";
describe("integration: storage.shared.json",
    require('freedom/spec/providers/storage/storage.integration.src').bind(this, shared, setup, false));

describe("integration: transport.webrtc.json",
    require('freedom/spec/providers/transport/transport.integration.src').bind(this,
    "providers/transport/webrtc/transport.webrtc.json", setup));

describe("integration: core.tcpsocket",
    require('freedom/spec/providers/coreIntegration/tcpsocket.integration.src').bind(this,
    require('../providers/core.tcpsocket'), setup));
