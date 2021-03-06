function UDP_Firefox(cap, dispatchEvent) {
  this.dispatchEvent = dispatchEvent;
  // http://dxr.mozilla.org/mozilla-central/source/netwerk/base/public/nsIUDPSocket.idl
  this._nsIUDPSocket = Components.classes["@mozilla.org/network/udp-socket;1"]
    .createInstance(Components.interfaces.nsIUDPSocket);
}

UDP_Firefox.prototype.bind = function(address, port, continuation) {
  if (port < 1) {
    port = -1;
  }
  // This interface appears to be IPv4-only, and only supports binding to
  // localhost or any-interface.  To minimize confusion, we restrict binding
  // to these supported addresses.
  // TODO: Remove this check once https://bugzilla.mozilla.org/show_bug.cgi?id=1178427
  // is fixed.
  var isLocal = address === "127.0.0.1" || address === "localhost";
  var isAny = address === "0.0.0.0";
  if (!isLocal && !isAny) {
    continuation(undefined, {
      errcode: "INVALID_ARGUMENT",
      message: "Can't bind " + address +
          "; only 127.0.0.1 and 0.0.0.0 are supported in Firefox."
    });
    return;
  }
  try {
    var appInfo = Components.classes["@mozilla.org/xre/app-info;1"]
      .getService(Components.interfaces.nsIXULAppInfo);
    var vc = Components.classes["@mozilla.org/xpcom/version-comparator;1"]
      .getService(Components.interfaces.nsIVersionComparator);
    if(vc.compare(appInfo.version, "40") >= 0) {
      // running under Firefox 40 or later
      var systemPrincipal = Components.classes["@mozilla.org/systemprincipal;1"]
          .createInstance(Components.interfaces.nsIPrincipal);
      this._nsIUDPSocket.init(port, isLocal, systemPrincipal);
    } else {
      this._nsIUDPSocket.init(port, isLocal);
    }
    this._nsIUDPSocket.asyncListen(new nsIUDPSocketListener(this));
    continuation(0);
  } catch (e) {
    continuation(undefined, {
      errcode: "UNKNOWN",
      message: "Failed to Bind: " + e.message
    });
  }
};

UDP_Firefox.prototype.getInfo = function(continuation) {
  var returnValue = {
    localAddress: this._nsIUDPSocket.localAddr.address,
    localPort: this._nsIUDPSocket.localAddr.port
  };
  continuation(returnValue);
};

UDP_Firefox.prototype.sendTo = function(buffer, address, port, continuation) {
  var asArray = [];
  var view = new Uint8Array(buffer);
  for (var i = 0; i < buffer.byteLength; i++) {
    asArray.push(view[i]);
  }
  var bytesWritten = this._nsIUDPSocket.send(address,
                                             port,
                                             asArray,
                                             asArray.length);
  continuation(bytesWritten);
};

UDP_Firefox.prototype.destroy = function(continuation) {
  this._nsIUDPSocket.close();
  continuation();
};

function nsIUDPSocketListener(udpSocket) {
  this._udpSocket = udpSocket;
}

nsIUDPSocketListener.prototype.onPacketReceived = function(nsIUDPSocket,
                                                           message) {
  var eventData = {
    resultCode: 0,
    address: message.fromAddr.address,
    port: message.fromAddr.port,
    data: this.str2ab(message.data)
  };
  this._udpSocket.dispatchEvent("onData",
                                eventData);
};

nsIUDPSocketListener.prototype.onStopListening = function(nsIUDPSocket,
                                                          status) {
};

nsIUDPSocketListener.prototype.str2ab = function(str) {
  var buf = new ArrayBuffer(str.length);
  var bufView = new Uint8Array(buf);
  for (var i=0, strLen=str.length; i<strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
};

/** REGISTER PROVIDER **/
exports.provider = UDP_Firefox;
exports.name = "core.udpsocket";
