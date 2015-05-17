/*global angular*/
(function withAngular(angular) {
  'use strict';

  angular.module('bitNFC', [
    'ionic',
    '720kb.fx',
    'bitNFC.filters',
    'bitNFC.providers',
    'bitNFC.factories',
    'bitNFC.controllers',
    'bitNFC.directives'])

  .constant('Config', {
    'currencies': ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'HKD']//,
    // 'denominations': ['BTC', 'SATOSHI', 'mBTC']
  })

  .config(['$stateProvider', '$urlRouterProvider', '$logProvider', '$httpProvider',
    function configurationFunction($stateProvider, $urlRouterProvider, $logProvider, $httpProvider) {

      $logProvider.debugEnabled(true);
      $stateProvider
      .state('app', {
        'url': '/app',
        'abstract': true,
        'templateUrl': 'views/layout/index.html'
      })
      .state('app.home', {
        'url': '/home',
        'views': {
          'appContent': {
            'templateUrl': 'views/home/index.html',
            'controller': 'HomeCtrl'
          }
        }
      })
      .state('app.receive', {
        'url': '/receive/:pvk',
        'views': {
          'appContent': {
            'templateUrl': 'views/receive/index.html',
            'controller': 'ReceiveCtrl'
          }
        }
      })
      .state('app.send', {
        'url': '/send/:nfcAddress',
        'views': {
          'appContent': {
            'templateUrl': 'views/send/index.html',
            'controller': 'SendCtrl'
          }
        }
      });

      $urlRouterProvider.otherwise('/app/home');
      $httpProvider.interceptors.push('CordovaNetworkInterceptor');
  }])

  .run(['$ionicPlatform', '$rootScope', '$window', '$state', '$ionicPopup', '$log', '$filter', 'nfc', 'BitCoin',
    function onApplicationStart($ionicPlatform, $rootScope, $window, $state, $ionicPopup, $log, $filter, nfc, BitCoin) {

    $rootScope.debugMode = true; //false

    $ionicPlatform.ready(function onReady() {

      if ($window.cordova &&
        $window.cordova.plugins &&
        $window.cordova.plugins.Keyboard) {

        $window.cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
      }

      if ($window.StatusBar) {

        $window.StatusBar.styleLightContent();
      }

      $rootScope.$emit('system:started');
    });

    $rootScope.$on('nfc:status-ok', function onNfcStatusOk() {

      $rootScope.nfcStatus = true;
    });

    $rootScope.$on('nfc:status-ko', function onNfcStatusOk(eventsInformations, payload) {

      $rootScope.nfcStatus = false;
      if (payload &&
        payload.error) {

        $ionicPopup.alert({
          'title': 'Oh snap!',
          'template': payload.error
        });
      }
    });

    $rootScope.$on('nfc:status-empty', function onEmptyTag() {

      var privateKey = BitCoin.generatePrivateKey();
      $rootScope.tagAddress = privateKey.toAddress();
      nfc.writeTag(privateKey.toString());

      $ionicPopup.confirm({
        'title': 'An empty NFC tag was found',
        'templateUrl': 'views/popup/empty-tag.html',
        'scope': $rootScope,
        'buttons': [
          {
            'text': 'Cancel'
          },
          {
            'text': 'OK',
            'type': 'button-dark',
            'onTap': function onTap() {

              $state.go('app.send', {
                'nfcAddress': $rootScope.tagAddress
              });
              // TODO: focus on amount field - http://stackoverflow.com/a/22751353/160699 ?
            }
          }
        ]
      });
    });

    $rootScope.$on('nfc:status-message', function onMessageTag(eventsInformations, payload) {

      if (payload &&
        payload.privateKey) {

        var tagPrivateKey = payload.privateKey;
        $rootScope.tagAddress = payload.address;
        $rootScope.tagBalance = payload.balance;

        $ionicPopup.confirm({
          'title': 'NFC Wallet found!',
          'templateUrl': 'views/popup/nfc-wallet.html',
          'scope': $rootScope,
          'buttons': [
            {
              'text': 'Cancel'
            },
            {
              'text': 'OK',
              'type': 'button-dark',
              'onTap': function onTap() {

                $log.log('sweeping tag with private key: ' + tagPrivateKey);

                BitCoin.sweep(tagPrivateKey).then(function onSweep() {
                  $log.log('swept!');

                  BitCoin.balance().then(function onBalance(newBalance) {
                    var newBalanceMbtc = $filter('UnitConvert')(newBalance, 'satoshisToMbtc');

                    $ionicPopup.alert({
                    'title': 'Tag Swept successfully!',
                    'template': '<p>Your balance is now:</p><p>' + newBalanceMbtc + ' mBTC</p>',
                    'buttons': [
                      {
                        'text': 'OK',
                        'type': 'button-dark',
                        'onTap': function onTap() {

                          $state.go('app.home');
                          $rootScope.$emit('balance:trigger-refresh');
                        }
                      }
                    ]
                  });
                  });
                }).catch(function onSweepError(info) {
                  $log.log('Sweep - an error occurred: ' + JSON.stringify(info));

                  // TODO: mostra il tempo dell'ultima conferma - dice:
                  // 'X minutes elapsed from the latest block'
                  // <small>usually it takes about 10 minutes for a new block to be found</small>
                  // use: https://blockchain.info/latestblock

                  $ionicPopup.alert({
                    'title': 'An error occurred',
                    'template': '<p>NFC Wallet Sweep action was not possible at this time.</p><p>hint: Probably you have to wait for at least one confirmation to do this action.</p>',
                    'buttons': [
                      {
                        'text': 'OK',
                        'type': 'button-dark'
                      }
                    ]
                  });
                });
              }
            }
          ]
        });
      }
    });

    $rootScope.$on('network:offline', function onNetworkOffline() {

      $ionicPopup.confirm({
        'title': 'NETWORK ERROR',
        'templateUrl': 'views/popup/network-down.html'
      }).then(function onUserTouch(res) {

        if (res) {

          $state.go('app.home');
        }
      });
    });
  }]);
}(angular));
