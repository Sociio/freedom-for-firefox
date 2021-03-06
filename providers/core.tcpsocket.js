var ClientSocket = require('./client_socket');
var ServerSocket = require('./server_socket');

function Socket_firefox(cap, dispatchEvent, socketId) {
  var incomingConnections = Socket_firefox.incomingConnections;

  // Whether prepareSecure() was called before connect.  If so, this will be a
  // TLS socket from the start.  Otherwise, secure() will convert from insecure
  // to secure (STARTTLS) if it is called.
  this.secureOnStart = false;
  this.dispatchEvent = dispatchEvent;
  this.socketId = socketId;
  if (socketId in incomingConnections) {
    this.clientSocket = incomingConnections[socketId];
    delete incomingConnections[socketId];
    if (!Socket_firefox.activeConnections[this.clientSocket]) {
      delete this.clientSocket.transport;
    }
    this.clientSocket.setOnDataListener(this._onData.bind(this));
    this.clientSocket.onDisconnect = function(err) {
      if (!err) {
        err = {
          "errcode": "CONNECTION_CLOSED",
          "message": "Connection closed gracefully"
        };
      }
      this.dispatchEvent("onDisconnect", err);
    }.bind(this);
  }
}

Socket_firefox.incomingConnections = {};
Socket_firefox.activeConnections = {};
Socket_firefox.socketNumber = 1;

Socket_firefox.prototype.getInfo = function(continuation) {
  if (this.clientSocket) {
    continuation(this.clientSocket.getInfo());
  } else if (this.serverSocket) {
    continuation(this.serverSocket.getInfo());
  } else {
    continuation({
      connected: false
    });
  }
};

Socket_firefox.prototype.close = function(continuation) {
  if (!this.clientSocket && !this.serverSocket) {
    continuation(undefined, {
    "errcode": "SOCKET_CLOSED",
    "message": "Cannot close non-connected socket"
    });
  } else if (this.clientSocket) {
    this.clientSocket.close({
      "errcode": "SUCCESS",
      "message": "Socket closed by call to close"
    });
    delete Socket_firefox.activeConnections[this.clientSocket];
  } else if (this.serverSocket) {
    this.serverSocket.disconnect({
      "errcode": "SUCCESS",
      "message": "Socket closed by call to close"
    });
  } else {
    continuation(undefined, {
      'errcode': 'SOCKET_CLOSED',
      'message': 'Socket Already Closed, or was never opened'
    });
    return;
  }
  continuation();
};

// TODO: handle failures.
Socket_firefox.prototype.connect = function(hostname, port, continuation) {
  this.clientSocket = new ClientSocket();
  this.clientSocket.onDisconnect = function(err) {
    if (!err) {
      err = {
        "errcode": "CONNECTION_CLOSED",
        "message": "Connection closed gracefully"
      };
    }
    this.dispatchEvent("onDisconnect", err);
  }.bind(this);
  this.hostname = hostname;
  this.port = port;
  this.clientSocket.setOnDataListener(this._onData.bind(this));
  var secureType = this.secureOnStart ? 'ssl' : null;
  this.clientSocket.connect(hostname, port, secureType, continuation);
};

Socket_firefox.prototype.prepareSecure = function(continuation) {
  if (!this.clientSocket) {
    this.secureOnStart = true;
  }
  continuation();
};

// TODO: handle failures.
Socket_firefox.prototype.secure = function(continuation) {
  if (this.secureOnStart) {
    continuation();
    return;
  }
  if (!this.hostname || !this.port || !this.clientSocket) {
    continuation(undefined, {
      "errcode": "NOT_CONNECTED",
      "message": "Cannot secure non-connected Socket"
    });
    return;
  }
  // Create a new ClientSocket (nsISocketTransport) object for the existing
  // hostname and port, using type 'starttls'.  This will upgrade the existing
  // connection to TLS, rather than create a new connection.
  // TODO: check to make sure this doesn't result in weird race conditions if
  // we have 2 pieces of code both trying to connect to the same hostname/port
  // and do a starttls flow (e.g. if there are 2 instances of a GTalk social
  // provider that are both trying to connect to GTalk simultaneously with
  // different logins).
  this.clientSocket.onDisconnect = undefined;  // avoid undesired dispatching
  this.clientSocket = new ClientSocket();
  // TODO: DRY this code up (see 'connect' above)
  this.clientSocket.onDisconnect = function(err) {
    this.dispatchEvent("onDisconnect", err);
  }.bind(this);
  this.clientSocket.setOnDataListener(this._onData.bind(this));
  this.clientSocket.connect(this.hostname, this.port, 'starttls', continuation);
};

Socket_firefox.prototype.write = function(buffer, continuation) {
  if (!this.clientSocket) {
    continuation(undefined, {
      "errcode": "NOT_CONNECTED",
      "message": "Cannot write non-connected socket"
    });
  } else {
    this.clientSocket.write(buffer);
    continuation();
  }
};

Socket_firefox.prototype.pause = function(continuation) {
  if (!this.clientSocket) {
    continuation(undefined, {
      "errcode": "NOT_CONNECTED",
      "message": "Can only pause a connected client socket"
    });
  } else {
    this.clientSocket.pause();
    continuation();
  }
};

Socket_firefox.prototype.resume = function(continuation) {
  if (!this.clientSocket) {
    continuation(undefined, {
      "errcode": "NOT_CONNECTED",
      "message": "Can only resume a connected client socket"
    });
  } else {
    this.clientSocket.resume();
    continuation();
  }
};

Socket_firefox.prototype.listen = function(host, port, continuation) {
  if (typeof this.serverSocket !== 'undefined') {
    continuation(undefined, {
      "errcode": "ALREADY_CONNECTED",
      "message": "Cannot listen on existing socket."
    });
  } else {
    try {
      this.serverSocket = new ServerSocket(host, port);
      this.host = host;
      this.port = port;
      this.serverSocket.onConnect = this._onConnect.bind(this);
      this.serverSocket.onDisconnect = function(err) {
        this.dispatchEvent("onDisconnect", err);
      }.bind(this);
      this.serverSocket.listen();
      continuation();
    } catch (e) {
      // Firefox sometimes gets colliding server sockets w/out triggering
      // this.serverSocket !== undefined above
      if (e.message ===
          "Component returned failure code: 0x804b0036 " +
          "(NS_ERROR_SOCKET_ADDRESS_IN_USE) [nsIServerSocket.init]") {
        continuation(undefined, {
          "errcode": "ALREADY_CONNECTED",
          "message": "Cannot listen on existing socket."
        });
      } else {
        continuation(undefined, {
          "errcode": "UNKNOWN",
          "message": e.message
        });
      }
    }
  }
};

Socket_firefox.prototype._onData = function(buffer) {
  this.dispatchEvent("onData",
                     {data: buffer.buffer});
};

Socket_firefox.prototype._onConnect = function(clientSocket) {
  var socketNumber = Socket_firefox.socketNumber++;
  Socket_firefox.incomingConnections[socketNumber] = clientSocket;
  Socket_firefox.activeConnections[clientSocket] = true;
  this.dispatchEvent("onConnection", {
    socket: socketNumber,
    host: this.host,
    port: this.port
  });

};

/** REGISTER PROVIDER **/
exports.provider = Socket_firefox;
exports.name = "core.tcpsocket";
