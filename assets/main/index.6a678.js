window.__require = function e(t, n, r) {
  function s(o, u) {
    if (!n[o]) {
      if (!t[o]) {
        var b = o.split("/");
        b = b[b.length - 1];
        if (!t[b]) {
          var a = "function" == typeof __require && __require;
          if (!u && a) return a(b, !0);
          if (i) return i(b, !0);
          throw new Error("Cannot find module '" + o + "'");
        }
        o = b;
      }
      var f = n[o] = {
        exports: {}
      };
      t[o][0].call(f.exports, function(e) {
        var n = t[o][1][e];
        return s(n || e);
      }, f, f.exports, e, t, n, r);
    }
    return n[o].exports;
  }
  var i = "function" == typeof __require && __require;
  for (var o = 0; o < r.length; o++) s(r[o]);
  return s;
}({
  HotUpdateModule: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "fe27eoEQN9EtJmz2mdvo4Vg", "HotUpdateModule");
    "use strict";
    var HotUpdateModule = cc.Class({
      extends: cc.Component,
      properties: {
        manifestUrl: cc.Asset,
        versionLabel: {
          default: null,
          type: cc.Label
        },
        _updating: false,
        _canRetry: false,
        _storagePath: ""
      },
      onLoad: function onLoad() {
        if (!cc.sys.isNative) return;
        this._storagePath = (jsb.fileUtils ? jsb.fileUtils.getWritablePath() : "/") + "client";
        this.versionCompareHandle = function(versionA, versionB) {
          var vA = versionA.split(".");
          var vB = versionB.split(".");
          for (var i = 0; i < vA.length; ++i) {
            var a = parseInt(vA[i]);
            var b = parseInt(vB[i] || 0);
            if (a === b) continue;
            return a - b;
          }
          return vB.length > vA.length ? -1 : 0;
        };
        this._am = new jsb.AssetsManager(this.manifestUrl.nativeUrl, this._storagePath, this.versionCompareHandle);
        this._am.setVerifyCallback(function(filePath, asset) {
          return true;
        });
        this.versionLabel && (this.versionLabel.string = "src:" + this._am.getLocalManifest().getVersion());
        cc.sys.os === cc.sys.OS_ANDROID, this._am.setMaxConcurrentTask(16);
      },
      onDestroy: function onDestroy() {
        if (!cc.sys.isNative) return;
        this._am.setEventCallback(null);
        this._am = null;
      },
      showLog: function showLog(msg) {
        cc.log("[HotUpdateModule][showLog]----" + msg);
      },
      retry: function retry() {
        if (!this._updating && this._canRetry) {
          this._canRetry = false;
          this._am.downloadFailedAssets();
        }
      },
      updateCallback: function updateCallback(event) {
        var needRestart = false;
        var failed = false;
        switch (event.getEventCode()) {
         case jsb.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
          this.showLog("The local manifest file was not found, and the hot update was skipped.");
          failed = true;
          break;

         case jsb.EventAssetsManager.UPDATE_PROGRESSION:
          var percent = event.getPercent();
          if (isNaN(percent)) return;
          var msg = event.getMessage();
          this.disPatchRateEvent(percent, msg);
          this.showLog("updateCallback Update progress:" + percent + ", msg: " + msg);
          break;

         case jsb.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
         case jsb.EventAssetsManager.ERROR_PARSE_MANIFEST:
          this.showLog("Failed to download manifest file, skip hot update.");
          failed = true;
          break;

         case jsb.EventAssetsManager.ALREADY_UP_TO_DATE:
          this.showLog("Already the latest version.");
          failed = true;
          break;

         case jsb.EventAssetsManager.UPDATE_FINISHED:
          this.showLog("The update is over." + event.getMessage());
          this.disPatchRateEvent(1);
          needRestart = true;
          break;

         case jsb.EventAssetsManager.UPDATE_FAILED:
          this.showLog("Update error." + event.getMessage());
          this._updating = false;
          this._canRetry = true;
          this._failCount++;
          this.retry();
          break;

         case jsb.EventAssetsManager.ERROR_UPDATING:
          this.showLog("Error during update:" + event.getAssetId() + ", " + event.getMessage());
          break;

         case jsb.EventAssetsManager.ERROR_DECOMPRESS:
          this.showLog("unzip error");
        }
        if (failed) {
          this._am.setEventCallback(null);
          this._updating = false;
        }
        if (needRestart) {
          this._am.setEventCallback(null);
          var searchPaths = jsb.fileUtils.getSearchPaths();
          var newPaths = this._am.getLocalManifest().getSearchPaths();
          Array.prototype.unshift.apply(searchPaths, newPaths);
          cc.sys.localStorage.setItem("HotUpdateSearchPaths", JSON.stringify(searchPaths));
          jsb.fileUtils.setSearchPaths(searchPaths);
          cc.audioEngine.stopAll();
          setTimeout(function() {
            cc.game.restart();
          }, 100);
        }
      },
      hotUpdate: function hotUpdate() {
        if (this._am && !this._updating) {
          this._am.setEventCallback(this.updateCallback.bind(this));
          if (this._am.getState() === jsb.AssetsManager.State.UNINITED) {
            var url = this.manifestUrl.nativeUrl;
            cc.assetManager.md5Pipe && (url = cc.assetManager.md5Pipe.transformURL(url));
            this._am.loadLocalManifest(url);
          }
          this._failCount = 0;
          this._am.update();
          this._updating = true;
        }
      },
      checkCallback: function checkCallback(event) {
        switch (event.getEventCode()) {
         case jsb.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
          this.showLog("The local manifest file was not found, and the hot update was skipped.");
          this.hotUpdateFinish(true);
          break;

         case jsb.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
         case jsb.EventAssetsManager.ERROR_PARSE_MANIFEST:
          this.showLog("Failed to download manifest file, skip hot update.");
          this.hotUpdateFinish(false);
          break;

         case jsb.EventAssetsManager.ALREADY_UP_TO_DATE:
          this.showLog("updated.");
          this.hotUpdateFinish(true);
          break;

         case jsb.EventAssetsManager.NEW_VERSION_FOUND:
          this.showLog("There is a new version, need to update");
          this._updating = false;
          this.hotUpdate();
          return;

         case jsb.EventAssetsManager.UPDATE_PROGRESSION:
          var percent = event.getPercent();
          if (isNaN(percent)) return;
          var msg = event.getMessage();
          this.showLog("checkCallback Update progress:" + percent + ", msg: " + msg);
          return;

         default:
          console.log("event.getEventCode():" + event.getEventCode());
          return;
        }
        this._am.setEventCallback(null);
        this._updating = false;
      },
      checkUpdate: function checkUpdate() {
        if (this._updating) {
          cc.log("Checking for updates...");
          return;
        }
        if (this._am.getState() === jsb.AssetsManager.State.UNINITED) {
          var url = this.manifestUrl.nativeUrl;
          cc.assetManager.md5Pipe && (url = cc.assetManager.md5Pipe.transformURL(url));
          this._am.loadLocalManifest(url);
        }
        if (!this._am.getLocalManifest() || !this._am.getLocalManifest().isLoaded()) {
          this.showLog("Failed to load manifest file");
          return;
        }
        this._am.setEventCallback(this.checkCallback.bind(this));
        this._am.checkUpdate();
        this._updating = true;
        this.disPatchRateEvent(.01);
      },
      hotUpdateFinish: function hotUpdateFinish(result) {
        cc.director.emit("HotUpdateFinish", result);
      },
      disPatchRateEvent: function disPatchRateEvent(percent) {
        percent > 1 && (percent = 1);
        cc.director.emit("HotUpdateRate", percent);
      }
    });
    cc._RF.pop();
  }, {} ],
  LoginView: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "6033bh2pLFOrIQ6XHG+xlRS", "LoginView");
    "use strict";
    cc.Class({
      extends: cc.Component,
      properties: {
        menuNode: {
          default: null,
          type: cc.Node
        },
        labelTips: {
          default: null,
          type: cc.Label
        }
      },
      onLoad: function onLoad() {
        this.menuNode.active = true;
      },
      onDestroy: function onDestroy() {},
      onEnable: function onEnable() {
        cc.director.on("HotUpdateFinish", this.onHotUpdateFinish, this);
        cc.director.on("HotUpdateRate", this.onHotUpdateRate, this);
      },
      onDisable: function onDisable() {
        cc.director.off("HotUpdateFinish", this.onHotUpdateFinish, this);
        cc.director.off("HotUpdateRate", this.onHotUpdateRate, this);
      },
      checkVersion: function checkVersion() {},
      onUpdateFinish: function onUpdateFinish() {
        this.menuNode.active = true;
        this.labelTips.string = "";
      },
      onHotUpdateFinish: function onHotUpdateFinish(param) {
        var result = param;
        result, this.onUpdateFinish();
      },
      onHotUpdateRate: function onHotUpdateRate(param) {
        var percent = param;
        percent > 1 && (percent = 1);
        this._updatePercent = percent;
        this.labelTips.string = "\u0110ANG TI\u1ebeN H\xc0NH C\u1eacP NH\u1eacT T\xc0I NGUY\xcaN GAME, TI\u1ebeN \u0110\u1ed8 C\u1eacP NH\u1eacT " + parseInt(1e4 * percent) / 100 + "%";
      },
      onBtnStartGame: function onBtnStartGame() {
        cc.director.loadScene("Game");
      },
      onBtnBill: function onBtnBill() {
        cc.director.loadScene("Game");
      }
    });
    cc._RF.pop();
  }, {} ],
  "audio-manager": [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "a7dbfKh+5JK04r9bLRSoPa2", "audio-manager");
    "use strict";
    var AudioManager = cc.Class({
      extends: cc.Component,
      properties: {
        coinsWin: {
          default: null,
          url: cc.AudioClip
        },
        coinsInsert: {
          default: null,
          url: cc.AudioClip
        },
        jackpotWin: {
          default: null,
          url: cc.AudioClip
        },
        lineWin: {
          default: null,
          url: cc.AudioClip
        },
        reelStart: {
          default: null,
          url: cc.AudioClip
        },
        reelRoll: {
          default: null,
          url: cc.AudioClip
        },
        reelStop: {
          default: null,
          url: cc.AudioClip
        },
        gameOver: {
          default: null,
          url: cc.AudioClip
        }
      },
      statics: {
        instance: null
      },
      playCoinsWin: function playCoinsWin() {
        cc.audioEngine.playMusic(this.coinsWin, false);
      },
      playCoinsInsert: function playCoinsInsert() {
        cc.audioEngine.playEffect(this.coinsInsert, false);
      },
      playJackpotWin: function playJackpotWin() {
        cc.audioEngine.playEffect(this.jackpotWin, false);
      },
      playLineWin: function playLineWin() {
        cc.audioEngine.playEffect(this.lineWin, false);
      },
      playReelStart: function playReelStart() {
        cc.audioEngine.playEffect(this.reelStart, false);
      },
      playReelRoll: function playReelRoll() {
        this.playSound(this.reelRoll);
      },
      playReelStop: function playReelStop() {
        cc.audioEngine.playEffect(this.reelStop, false);
      },
      playGameOver: function playGameOver() {
        cc.audioEngine.playEffect(this.gameOver, false);
      },
      playSound: function playSound(audioClip) {
        if (!audioClip) return;
        cc.audioEngine.playMusic(audioClip, false);
      },
      onLoad: function onLoad() {
        AudioManager.instance = this;
      }
    });
    cc._RF.pop();
  }, {} ],
  game: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "17a107hOA1DjJdGNDmkBd3y", "game");
    "use strict";
    var Reel = require("reel"), OnOffButton = require("on-off-button"), AudioManager = require("audio-manager"), UserDefault = require("user-default"), PayTableTags = require("paytable-tags")();
    cc.Class({
      extends: cc.Component,
      properties: {
        winAnimation: {
          default: null,
          type: cc.Animation
        },
        reels: {
          default: [],
          type: [ Reel ]
        },
        currentCredit: {
          default: 100,
          type: cc.Integer
        },
        betOneValue: {
          default: 1,
          type: cc.Integer
        },
        betMaxValue: {
          default: 5,
          type: cc.Integer
        },
        spinButton: {
          default: null,
          type: OnOffButton
        },
        autoSpinButton: {
          default: null,
          type: OnOffButton
        },
        betOneButton: {
          default: null,
          type: OnOffButton
        },
        betMaxButton: {
          default: null,
          type: OnOffButton
        },
        totalBetLabel: {
          default: null,
          type: cc.Label
        },
        creditLabel: {
          default: null,
          type: cc.Label
        },
        betInfoLabel: {
          default: null,
          type: cc.Label
        },
        rollingCompletedCount: {
          default: 0,
          visible: false,
          type: cc.Integer
        },
        isRollingCompleted: {
          default: true,
          visible: false
        },
        totalBetValue: {
          default: 0,
          visible: false,
          type: cc.Integer
        },
        currentBetValue: {
          default: 0,
          visible: false,
          type: cc.Integer
        },
        currentPayTableTag: {
          default: 0,
          visible: false,
          type: cc.Integer
        },
        isAutoSpin: {
          default: false,
          visible: false
        },
        autoSpinTimer: {
          default: null,
          visible: false
        }
      },
      onLoad: function onLoad() {
        var that = this;
        console.log("this::: " + this.spinButton);
        this.creditLabel.string = this.currentCredit.toString();
        this.betInfoLabel.string = "";
        this.spinButton.node.on("reel-spin", function(event) {
          event.isOn && that.spin();
        });
        this.autoSpinButton.node.on("reel-auto-spin", function(event) {
          true === that.isAutoSpin ? that.isAutoSpin = false : that.isAutoSpin = true;
          that.isAutoSpin ? event.isOn && that.spin() : clearTimeout(that.autoSpinTimer);
        });
        this.betOneButton.node.on("bet-one", function(event) {
          if (event.isOn) {
            that.betMaxButton.reset();
            that.currentBetValue = that.betOneValue;
            that.currentPayTableTag = PayTableTags.BET_ONE;
            that.betInfoLabel.string = that.currentBetValue.toString();
            AudioManager.instance.playCoinsInsert();
          }
        });
        this.betMaxButton.node.on("bet-max", function(event) {
          if (event.isOn) {
            that.betOneButton.reset();
            that.currentBetValue = that.betMaxValue;
            that.currentPayTableTag = PayTableTags.BET_MAX;
            that.betInfoLabel.string = that.currentBetValue.toString();
            AudioManager.instance.playCoinsInsert();
          }
        });
        this.node.on("rolling-completed", function(event) {
          that.rollingCompletedCount++;
          AudioManager.instance.playReelStop();
          if (that.rollingCompletedCount == that.reels.length) {
            that.rollingCompletedCount = 0;
            var lineSymbolsTags = [];
            lineSymbolsTags = that.getLineSymbolsTag();
            var paytable = that.getComponent("paytable"), paytableRet = paytable.isWinning(lineSymbolsTags, that.currentPayTableTag), isWinning = Object.keys(paytableRet).length > 0;
            if (isWinning) {
              that.isRollingCompleted = true;
              that.isAutoSpin ? that.autoSpinButton.reset() : that.spinButton.reset();
              that.isAutoSpin = false;
              that.winAnimation.play("win");
              AudioManager.instance.playLineWin();
              AudioManager.instance.playCoinsWin();
              that.showWinningSymbolsAndPay(paytableRet);
            } else {
              that.updateCurrenCredit(that.currentCredit - that.currentBetValue);
              that.betInfoLabel.string = (-that.currentBetValue).toString();
              if (that.isAutoSpin) that.autoSpinTimer = setTimeout(function() {
                that.spin();
              }, 1e3); else {
                that.isRollingCompleted = true;
                that.spinButton.reset();
              }
            }
            if (that.isRollingCompleted) {
              that.setButtonsLocked(false);
              UserDefault.instance.setCurrentCredit(that.currentCredit);
            }
          }
        });
      },
      start: function start() {
        this.loadUserDefault();
      },
      loadUserDefault: function loadUserDefault() {
        this.updateCurrenCredit(UserDefault.instance.getCurrentCredit(this.currentCredit));
      },
      spin: function spin() {
        if (0 === this.currentCredit) return;
        this.betInfoLabel.string = this.currentBetValue.toString();
        if (this.isRollingCompleted) {
          this.totalBetValue += this.currentBetValue;
          this.totalBetLabel.string = this.totalBetValue.toString();
          this.isAutoSpin || (this.isRollingCompleted = false);
          this.setButtonsLocked(true);
          AudioManager.instance.playReelRoll();
          for (var i = 0; i < this.reels.length; i++) this.reels[i].spin();
        }
      },
      setButtonsLocked: function setButtonsLocked(isLocked) {
        this.isAutoSpin || (this.autoSpinButton.isLocked = isLocked);
        this.spinButton.isLocked = isLocked;
        this.betOneButton.isLocked = isLocked;
        this.betMaxButton.isLocked = isLocked;
      },
      getLineSymbolsTag: function getLineSymbolsTag() {
        var lineSymbolsTags = [];
        for (var m = 0; m < this.reels.length; m++) {
          var stopNode = this.reels[m].getWinnerStop();
          var stopComponent = stopNode.getComponent("stop");
          lineSymbolsTags.push(stopComponent.tag);
        }
        return lineSymbolsTags;
      },
      showWinningSymbolsAndPay: function showWinningSymbolsAndPay(paytableRet) {
        var stopNode, stopComponent, winningAmount = 0;
        for (var i = 0; i < paytableRet.length; i++) {
          var item = paytableRet[i];
          for (var n = 0; n < item.indexes.length; n++) {
            stopNode = this.reels[item.indexes[n]].getWinnerStop();
            stopComponent = stopNode.getComponent("stop");
            stopComponent.blink();
          }
          winningAmount += parseInt(item.winningValue);
        }
        this.updateCurrenCredit(this.currentCredit + winningAmount);
        this.betInfoLabel.string = winningAmount.toString();
      },
      updateCurrenCredit: function updateCurrenCredit(value) {
        this.currentCredit = value;
        this.creditLabel.string = this.currentCredit.toString();
        if (parseInt(this.currentCredit) <= 0) {
          AudioManager.instance.playGameOver();
          this.updateCurrenCredit(100);
        }
      }
    });
    cc._RF.pop();
  }, {
    "audio-manager": "audio-manager",
    "on-off-button": "on-off-button",
    "paytable-tags": "paytable-tags",
    reel: "reel",
    "user-default": "user-default"
  } ],
  "on-off-button": [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "5357bF9y7pDjoX+fmXrnWY3", "on-off-button");
    "use strict";
    cc.Class({
      extends: cc.Component,
      properties: {
        mouseDownName: {
          default: "on-off-mousedown"
        },
        sprite: {
          default: null,
          type: cc.Sprite
        },
        spriteTextureDown: {
          default: null,
          type: cc.SpriteFrame
        },
        isOn: {
          default: false
        },
        spriteTextureUp: {
          default: "",
          visible: false,
          url: cc.Sprite
        },
        isLocked: {
          default: false,
          visible: false
        }
      },
      onLoad: function onLoad() {
        var that = this;
        this.spriteTextureUp = this.sprite._spriteFrame._texture;
        this.spriteTextureDown = this.spriteTextureDown._texture;
        function onTouchDown(event) {
          that.onOff();
        }
        function onTouchUp(event) {}
        this.node.on("touchstart", onTouchDown, this.node);
        this.node.on("touchend", onTouchUp, this.node);
        this.node.on("touchcancel", onTouchUp, this.node);
      },
      start: function start() {
        if (this.isOn) {
          this.isOn = false;
          this.onOff();
        }
      },
      onOff: function onOff() {
        if (this.isLocked) return;
        if (this.isOn) {
          this.updateSpriteFrame(this.sprite, this.spriteTextureUp);
          this.isOn = false;
        } else {
          this.updateSpriteFrame(this.sprite, this.spriteTextureDown);
          this.isOn = true;
        }
        this.node.emit(this.mouseDownName, {
          isOn: this.isOn
        });
      },
      reset: function reset() {
        this.isOn = false;
        this.isLocked = false;
        this.updateSpriteFrame(this.sprite, this.spriteTextureUp);
      },
      updateSpriteFrame: function updateSpriteFrame(sprite, texture) {
        if (!sprite || !texture) return;
        var w = sprite.node.width, h = sprite.node.height, frame = new cc.SpriteFrame(texture, cc.rect(0, 0, w, h));
        sprite.spriteFrame = frame;
      }
    });
    cc._RF.pop();
  }, {} ],
  "paytable-definition": [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "4b94bWer2JLr7DA4SmWX2NA", "paytable-definition");
    "use strict";
    var StopTags = require("stop-tags")(), PayTableTags = require("paytable-tags")();
    var paytableBetMax = [ {
      stopTag: StopTags.BONUS,
      5: 2e3,
      4: 1600,
      3: 1e3,
      2: 800
    }, {
      stopTag: StopTags.BANANA,
      5: 300,
      4: 260,
      3: 200,
      2: 100
    }, {
      stopTag: StopTags.BEGAMOT,
      5: 200,
      4: 160,
      3: 100,
      2: 50
    }, {
      stopTag: StopTags.COCODRILE,
      5: 200,
      4: 160,
      3: 100,
      2: 50
    }, {
      stopTag: StopTags.COCKTAIL,
      5: 200,
      4: 160,
      3: 100,
      2: 5
    }, {
      stopTag: StopTags.KAKADU,
      5: 100,
      4: 90,
      3: 75,
      2: 5
    }, {
      stopTag: StopTags.MAN,
      5: 100,
      4: 90,
      3: 75,
      2: 5
    }, {
      stopTag: StopTags.MONKEY,
      5: 100,
      4: 90,
      3: 75,
      2: 2
    }, {
      stopTag: StopTags.LION,
      5: 50,
      4: 40,
      3: 25,
      2: 2
    } ];
    var paytableBetOne = [ {
      stopTag: StopTags.BONUS,
      5: 200,
      4: 170,
      3: 100,
      2: 50
    }, {
      stopTag: StopTags.BANANA,
      5: 100,
      4: 80,
      3: 20,
      2: 10
    }, {
      stopTag: StopTags.BEGAMOT,
      5: 50,
      4: 40,
      3: 10,
      2: 5
    }, {
      stopTag: StopTags.COCODRILE,
      5: 50,
      4: 40,
      3: 10,
      2: 5
    }, {
      stopTag: StopTags.COCKTAIL,
      5: 20,
      4: 15,
      3: 10,
      2: 2
    }, {
      stopTag: StopTags.KAKADU,
      5: 10,
      4: 8,
      3: 5,
      2: 2
    }, {
      stopTag: StopTags.MAN,
      5: 10,
      4: 8,
      3: 5,
      2: 2
    }, {
      stopTag: StopTags.MONKEY,
      5: 10,
      4: 8,
      3: 5,
      2: 1
    }, {
      stopTag: StopTags.LION,
      5: 5,
      4: 3,
      3: 2,
      2: 1
    } ];
    var PayTableDefinition = function PayTableDefinition(paytableTag) {
      switch (paytableTag) {
       case PayTableTags.BET_ONE:
        return paytableBetOne;

       case PayTableTags.BET_MAX:
        return paytableBetMax;

       default:
        return paytableBetOne;
      }
    };
    module.exports = PayTableDefinition;
    cc._RF.pop();
  }, {
    "paytable-tags": "paytable-tags",
    "stop-tags": "stop-tags"
  } ],
  "paytable-tags": [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "ea2e2acVj1Hmpq3sPcOAYmv", "paytable-tags");
    "use strict";
    function PayTableTags() {
      return {
        BET_ONE: 0,
        BET_MAX: 1
      };
    }
    module.exports = PayTableTags;
    cc._RF.pop();
  }, {} ],
  paytable: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "91f5f5bVWpFDYv2UMKKXJYb", "paytable");
    "use strict";
    var PayTableDefinition = require("paytable-definition"), StopTags = require("stop-tags")();
    cc.Class({
      extends: cc.Component,
      properties: {},
      onLoad: function onLoad() {},
      isWinning: function isWinning(lineSymbolsTags, paytableTag) {
        var lineCombinations = {};
        for (var i = 0; i < lineSymbolsTags.length; i++) {
          var firstItem = lineSymbolsTags[i];
          var previousItem = i > 0 ? lineSymbolsTags[i - 1] : -1;
          var indexes = [];
          var tags = [];
          indexes.push(i);
          for (var n = i + 1; n < lineSymbolsTags.length; n++) {
            var item = lineSymbolsTags[n];
            if (firstItem != item || item == previousItem) break;
            indexes.push(n);
            lineCombinations[firstItem] = {
              indexes: indexes
            };
          }
        }
        if (Object.keys(lineCombinations).length > 0) return this.check(lineCombinations);
        return [];
      },
      check: function check(lineCombinations, paytableTag) {
        var paytable = PayTableDefinition(paytableTag);
        var ret = [];
        for (var tag in lineCombinations) if (lineCombinations.hasOwnProperty(tag)) var retObject = paytable.filter(function(item) {
          if (item.stopTag == tag) {
            var winningValue = parseInt(item[lineCombinations[tag].indexes.length].toString());
            winningValue > 0 && ret.push({
              indexes: lineCombinations[tag].indexes,
              winningValue: item[lineCombinations[tag].indexes.length].toString(),
              winningTag: tag
            });
          }
        });
        return ret;
      }
    });
    cc._RF.pop();
  }, {
    "paytable-definition": "paytable-definition",
    "stop-tags": "stop-tags"
  } ],
  prng: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "f86f5iz5DNJDqogRC4T+OHu", "prng");
    "use strict";
    function PRNG() {
      return {
        newValue: function newValue(min, max) {
          return Math.floor(Math.random() * (max - min + 1)) + min;
        }
      };
    }
    module.exports = PRNG;
    cc._RF.pop();
  }, {} ],
  reel: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "3d805IS8GdKi4fpFoRADeDr", "reel");
    "use strict";
    var PRNG = require("prng")();
    cc.Class({
      extends: cc.Component,
      properties: {
        stops: {
          default: [],
          type: [ cc.Prefab ]
        },
        prngMinRange: {
          default: 1,
          type: cc.Integer
        },
        prngMaxRange: {
          default: 1e9,
          type: cc.Integer
        },
        stopNodes: {
          default: [],
          visible: false,
          type: [ cc.Node ]
        },
        tailNode: {
          default: null,
          visible: false,
          type: cc.Node
        },
        visibleStops: {
          default: 3,
          visible: false,
          type: cc.Integer
        },
        padding: {
          default: 0,
          visible: false,
          type: cc.Integer
        },
        stopHeight: {
          default: 0,
          visible: false,
          type: cc.Integer
        },
        stepY: {
          default: 0,
          visible: false,
          type: cc.Integer
        },
        rollingCount: {
          default: 0,
          visible: false,
          type: cc.Integer
        },
        winnerIndex: {
          default: 0,
          visible: false,
          type: cc.Integer
        },
        stopAfterRollingCount: {
          default: 0,
          visible: false,
          type: cc.Integer
        },
        winnerLineY: {
          default: 0,
          visible: false,
          type: cc.Integer
        },
        isRollingCompleted: {
          default: false,
          visible: false
        }
      },
      onLoad: function onLoad() {
        console.log("reelllll");
        console.log(this.node.height);
        this.winnerLineY = this.node.height / 2;
        var firstStop = cc.instantiate(this.stops[0]);
        this.stopHeight = firstStop.height;
        this.padding = (this.node.height - this.visibleStops * this.stopHeight) / (this.visibleStops + 1);
        this.stepY = this.stopHeight / 5;
        var startY = this.node.height - this.padding - this.stopHeight;
        var startX = this.node.width / 2 - firstStop.width / 2;
        for (var i = 0; i < this.stops.length; i++) {
          var stop = cc.instantiate(this.stops[i]);
          this.node.addChild(stop);
          stop.setPosition(cc.v2(startX, startY));
          startY = startY - this.padding - this.stopHeight;
          this.stopNodes.push(stop);
        }
        this.tailNode = this.stopNodes[this.stopNodes.length - 1];
        this.isRollingCompleted = true;
      },
      update: function update(dt) {
        if (this.isRollingCompleted) return;
        for (var i = 0; i < this.stopNodes.length; i++) {
          var stop = this.stopNodes[i];
          stop.y = stop.y + this.stepY;
          if (stop.y - this.padding > this.node.height) {
            i + 1 == this.stopNodes.length && this.rollingCount++;
            stop.y = this.tailNode.y - this.tailNode.height - this.padding;
            this.tailNode = stop;
          }
          if (this.stopAfterRollingCount == this.rollingCount && i == this.winnerIndex && stop.y >= this.winnerLineY) {
            if (0 === this.winnerIndex) {
              this.tailNode.y = stop.y + stop.height;
              this.tailNode = this.stopNodes[this.stopNodes.length - 2];
            }
            this.resetY(stop);
            this.isRollingCompleted = true;
            this.node.dispatchEvent(new cc.Event.EventCustom("rolling-completed", true));
          }
        }
      },
      resetY: function resetY(currentStop) {
        var deltaY = currentStop.y - this.winnerLineY + currentStop.height / 2;
        var lastItemWon = this.winnerIndex === this.stopNodes.length - 1;
        for (var i = 0; i < this.stopNodes.length; i++) {
          var newStop = this.stopNodes[i];
          newStop.y = newStop.y - deltaY;
          lastItemWon && newStop.y < this.winnerLineY && i != this.winnerIndex && (newStop.y = newStop.y + this.padding);
        }
      },
      spin: function spin() {
        var min = 1;
        var max = 2;
        this.rollingCount = 0;
        this.stopAfterRollingCount = Math.floor(Math.random() * (max - min + 1)) + min;
        var randomValue = PRNG.newValue(this.prngMinRange, this.prngMaxRange);
        this.winnerIndex = randomValue % this.stops.length;
        this.isRollingCompleted = false;
      },
      getWinnerStop: function getWinnerStop() {
        return this.stopNodes[this.winnerIndex];
      }
    });
    cc._RF.pop();
  }, {
    prng: "prng"
  } ],
  "stop-tags": [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "b1f8fcCyUlAQYXKla3YDX5/", "stop-tags");
    "use strict";
    function StopTags() {
      return {
        BANANA: 1,
        BEGAMOT: 2,
        BONUS: 3,
        COCKTAIL: 4,
        COCODRILE: 5,
        KAKADU: 6,
        LION: 7,
        MAN: 8,
        MONKEY: 9
      };
    }
    module.exports = StopTags;
    cc._RF.pop();
  }, {} ],
  stop: [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "7c9d92+IOBMGKwSTChSoIVi", "stop");
    "use strict";
    cc.Class({
      extends: cc.Component,
      properties: {
        tag: {
          default: 0,
          type: cc.Integer
        },
        blinkTimer: {
          default: null,
          visible: false
        },
        blinkCounter: {
          default: 0,
          visible: false
        }
      },
      onLoad: function onLoad() {},
      blink: function blink() {
        var that = this;
        this.blinkTimer = setInterval(function() {
          that.blinkCounter++;
          true === that.node.active ? that.node.active = false : that.node.active = true;
          if (10 == that.blinkCounter) {
            that.blinkCounter = 0;
            that.node.active = true;
            clearInterval(that.blinkTimer);
          }
        }, 300);
      }
    });
    cc._RF.pop();
  }, {} ],
  "use_v2.0.x_cc.Toggle_event": [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "8c22eSyM3hMNLZSDMPpSIrC", "use_v2.0.x_cc.Toggle_event");
    "use strict";
    cc.Toggle && (cc.Toggle._triggerEventInScript_check = true);
    cc._RF.pop();
  }, {} ],
  "user-default-keys": [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "246ab4anldKkYCjr7FirIEK", "user-default-keys");
    "use strict";
    function UserDefaultKeys() {
      return {
        CURRENT_CREDIT: "Current_Credit"
      };
    }
    module.exports = UserDefaultKeys;
    cc._RF.pop();
  }, {} ],
  "user-default": [ function(require, module, exports) {
    "use strict";
    cc._RF.push(module, "ac85aN0yDZAy5qM8en8FeDQ", "user-default");
    "use strict";
    var UserDefaultKeys = require("user-default-keys")();
    var UserDefault = cc.Class({
      extends: cc.Component,
      properties: {
        localStorage: {
          default: null,
          visible: false,
          type: Object
        }
      },
      onLoad: function onLoad() {
        this.localStorage = cc.sys.localStorage;
        UserDefault.instance = this;
      },
      statics: {
        instance: null
      },
      getCurrentCredit: function getCurrentCredit(defaultValue) {
        var data = this.localStorage.getItem(UserDefaultKeys.CURRENT_CREDIT);
        data || (data = defaultValue);
        return data ? parseInt(data) : 0;
      },
      setCurrentCredit: function setCurrentCredit(value) {
        this.localStorage.setItem(UserDefaultKeys.CURRENT_CREDIT, value);
      }
    });
    cc._RF.pop();
  }, {
    "user-default-keys": "user-default-keys"
  } ]
}, {}, [ "use_v2.0.x_cc.Toggle_event", "audio-manager", "game", "paytable-definition", "paytable-tags", "paytable", "prng", "reel", "stop-tags", "stop", "user-default-keys", "user-default", "HotUpdateModule", "LoginView", "on-off-button" ]);