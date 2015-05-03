angular
  .module('CalendarExt', ['ngResource'])
  .config(['$httpProvider', 'Token', function ($httpProvider, Token) {
    $httpProvider.interceptors.push(function() {
      return {
        request: function(config) {
          config.headers.Authorization = 'Bearer ' + Token;
          return config;
        },
        responseError: function(error) {
          if (error.status === 401) {
            chrome.identity.removeCachedAuthToken({ 'token': Token }, function() {});
          }
        }
      };
    });
  }])
  .service('ChromeCache', ['$q', function($q) {
    return {
      set: function(key, value) {
        var deferred = $q.defer();
        var obj = {};
        obj[key] = value;
        chrome.storage.local.set(obj, function() {
          deferred.resolve();
        });
        return deferred.promise;
      },
      get: function(key) {
        var deferred = $q.defer();
        chrome.storage.local.get(key, function(items) {
          deferred.resolve(items);
        });
        return deferred.promise;
      }
    };
  }])
  .run(['ChromeCache', '$rootScope', '$interval', '$document', function (ChromeCache, $rootScope, $interval, $document) {

    $rootScope.today = new Date();
    $rootScope.clock = new Date();
    $interval(function() {
      $rootScope.clock = new Date();
      if ($rootScope.today.getDay() !== new Date().getDay()) {
        $rootScope.today = new Date();
      }
    }, 1000);

  }])
  .factory('GoogleAPI', ['$resource', '$rootScope', function ($resource, $rootScope) {

    var y = $rootScope.today.getFullYear();
    var m = $rootScope.today.getMonth();

    return $resource('https://www.googleapis.com/calendar/v3/:url', {}, {
      getCalendars: {
        method: 'GET',
        url: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      },
      getEventsFromCalendar: {
        method: 'GET',
        url: 'https://www.googleapis.com/calendar/v3/calendars/:calendarId/events',
        params: {
          timeMax: (function() {
            return new Date(y, m + 1, 15);
          })(),
          timeMin: (function() {
            return new Date(y, m - 1, 15);
          })()
        }
      },
      getUnreadMails: {
        method: 'GET',
        url: 'https://www.googleapis.com/gmail/v1/users/me/messages',
        params: {
          labelIds: ['UNREAD', 'INBOX']
        }
      }
    });

  }])
  .directive('calendar', ['$rootScope', '$http', '$q', '$filter', '$timeout', 'GoogleAPI', 'ChromeCache', function($rootScope, $http, $q, $filter, $timeout, GoogleAPI, ChromeCache) {
    return {
      restrict: 'E',
      replace: true,
      link: function(scope, element, attrs) {
        $rootScope.$watch('today', function() {
          scope.Months = (function() {
            var months = [];
            var now = _.clone($rootScope.today);
            for (var i = 0; i < 12; i++) {
              months.push(new Date(now.setMonth(i)));
            }
            return months;
          })();
          scope.Days = (function() {
            var days = [];
            var now = _.clone($rootScope.today);
            var prevMonth = new Date(_.clone($rootScope.today).setDate(0));
            var nextMonth = new Date(_.clone($rootScope.today).setDate(32));
            var currentMonth = new Date(_.clone(nextMonth).setDate(0));
            for (var i = prevMonth.getDay(); i >= 0 && i < 6; i--) {
              days.push(new Date(_.clone(prevMonth).setDate(prevMonth.getDate() - i)));
            }
            for (i = 1; i <= currentMonth.getDate(); i++) {
              days.push(new Date(now.setDate(i)));
            }
            now.setDate(currentMonth.getDate() + 1);
            for (i = now.getDay(); i > 0 && days.length < 42; i++) {
              days.push(new Date(now));
              now.setDate(now.getDate() + 1);
            }
            return days;
          })();
        });

        scope.isToday = function(d) {
          return $rootScope.today.getDate() === d.getDate() && $rootScope.today.getMonth() === d.getMonth();
        };

        scope.isActiveDay = function(d) {
          if (!scope.activeDay) return;
          return scope.activeDay.getDate() === d.getDate() && scope.activeDay.getMonth() === d.getMonth();
        };

        scope.hasEvents = function(d) {
          var day = new Date(d);
          day.setHours(0, 0, 0, 0);
          return _.some(scope.events, function(event) {
            var eventDate = new Date(event.start.dateTime || event.start.date);
            eventDate.setHours(0,0,0,0);
            return eventDate.getTime() === day.getTime();
          });
        };

        scope.setActiveEvents = function(d) {
          scope.odd = !scope.odd;
          var odd = scope.odd ? 'Odd' : 'Even';
          var day = new Date(d);
          day.setHours(0, 0, 0, 0);
          scope.activeDay = scope['activeDay' + odd] = day;
          scope['activeEvents' + odd] = _.filter(scope.events, function(event) {
            var eventDate = new Date(event.start.dateTime || event.start.date);
            eventDate.setHours(0,0,0,0);
            return eventDate.getTime() === day.getTime();
          });
        };

        scope.startAttribute = function(event) {
          return event.start.dateTime || event.start.date;
        };

        $timeout(function() {
          Waves.attach('.calendar-day-event', 'waves-light');
          Waves.attach('.calendar-day-today', 'waves-circle waves-light');
          Waves.init();
        });

        ChromeCache.get('events').then(function(cache) {
          scope.events = cache.events;
          if (!scope.activeDay) {
            scope.setActiveEvents($rootScope.today);
          }
        });

        GoogleAPI.getCalendars().$promise.then(function(calendars) {
          var promises = calendars.items.map(function(calendar) {
             return GoogleAPI.getEventsFromCalendar({ calendarId: calendar.id }).$promise;
          });
          $q.all(promises).then(function(events) {
            scope.events = _.reduce(events, function(list, events) {
              list = list.items || list;
              return list.concat(events.items);
            });
            if (!scope.activeDay) {
              scope.setActiveEvents($rootScope.today);
            }
            ChromeCache.set('events', angular.copy(scope.events));
          });
        });
      },
      templateUrl: 'calendar.html'
    };
  }])
  .directive('gmail', ['GoogleAPI', function(GoogleAPI) {
    return {
      restrict: 'E',
      link: function(scope, element, attrs) {
        GoogleAPI.getUnreadMails().$promise.then(function(mails) {
          element[0].className += ' gmail-visible';
          scope.unreadCount = mails.resultSizeEstimate;
          scope.gmail = true;
        });
      },
      templateUrl: 'gmail.html'
    };
  }]);

chrome.identity.getAuthToken({ interactive: true }, function(token) {
  angular.element(document).ready(function() {
    angular.module('CalendarExt').constant('Token', token);
    angular.bootstrap(document, ['CalendarExt']);
  });
});
