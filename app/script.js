angular
  .module('CalendarExt', ['ngAnimate', 'ngResource'])
  .run(['$rootScope', '$interval', '$document', function ($rootScope, $interval, $document) {

    $rootScope.today = new Date();
    $rootScope.clock = new Date();
    $interval(function() {
      $rootScope.clock = new Date();
      if ($rootScope.today.getDay() !== new Date().getDay()) {
        $rootScope.today = new Date();
      }
    }, 1000);

  }])
  .factory('GoogleAPI', ['$resource', '$rootScope', 'Token', function ($resource, $rootScope, Token) {

    var y = $rootScope.today.getFullYear();
    var m = $rootScope.today.getMonth();

    return $resource('https://www.googleapis.com/calendar/v3/:url', {}, {
      getCalendars: {
        method: 'GET',
        url: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        headers: { Authorization: 'Bearer ' + Token },
        interceptor: {
          responseError: function(error) {
            if (error.status === 401) {
              chrome.identity.removeCachedAuthToken({ 'token': Token }, function() {});
            }
          }
        }
      },
      getEventsFromCalendar: {
        method: 'GET',
        url: 'https://www.googleapis.com/calendar/v3/calendars/:calendarId/events',
        params: {
          timeMax: (function() {
            return new Date(y, m + 1, 0);
          })(),
          timeMin: (function() {
            return new Date(y, m, 1);
          })()
        },
        headers: { Authorization: 'Bearer ' + Token }
      },
      getUnreadMails: {
        method: 'GET',
        url: 'https://www.googleapis.com/gmail/v1/users/me/messages',
        params: {
          labelIds: ['UNREAD', 'INBOX']
        },
        headers: { Authorization: 'Bearer ' + Token }
      }
    });

  }])
  .directive('calendar', ['$rootScope', '$http', '$q', '$filter', 'GoogleAPI', function($rootScope, $http, $q, $filter, GoogleAPI) {
    return {
      restrict: 'E',
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
            for (i = now.getDay(); i > 0 && i <= 6; i++) {
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

        GoogleAPI.getCalendars().$promise.then(function(calendars) {
          var promises = calendars.items.map(function(calendar) {
             return GoogleAPI.getEventsFromCalendar({ calendarId: calendar.id }).$promise;
          });
          $q.all(promises).then(function(events) {
            scope.events = _.reduce(events, function(list, events) {
              list = list.items || list;
              return list.concat(events.items);
            });
            scope.setActiveEvents($rootScope.today);
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

chrome.identity.getAuthToken({ 'interactive': true }, function(token) {
  angular.element(document).ready(function() {
    angular.module('CalendarExt').constant('Token', token);
    angular.bootstrap(document, ['CalendarExt']);
  });
});
