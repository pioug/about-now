angular
  .module('CalendarExt', ['ngAnimate'])
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
  .directive('calendar', ['$rootScope', '$http', '$q', '$filter', function($rootScope, $http, $q, $filter) {
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
            var eventDate = new Date(event.startDate);
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
            var eventDate = new Date(event.startDate);
            eventDate.setHours(0,0,0,0);
            return eventDate.getTime() === day.getTime();
          });
        };

        $http.get('https://www.google.com/calendar/feeds/default/allcalendars/full').success(function(data) {
          var xml = angular.element(data);
          var entries = xml.find('entry');
          var titles = entries.find('title');
          var urls = entries.find('content');
          var calendars = [];
          for (var i = 0; i < entries.length; i++) {
            calendars.push(_.zipObject(['title', 'url'], [titles[i].innerText, urls[i].getAttribute('src')]));
          }
          var y = scope.today.getFullYear();
          var m = scope.today.getMonth();
          var firstDay = $filter('date')(new Date(y, m, 1), 'yyyy-MM-dd');
          var lastDay = $filter('date')(new Date(y, m + 1, 0), 'yyyy-MM-dd');
          var promises = calendars.map(function(calendar) {
            return $http({
              method: 'GET',
              url: calendar.url + '?start-min=' + firstDay + '&start-max=' + lastDay + '&max-results=300'
            });
          });
          return $q.all(promises)
          .then(function(results) {
            scope.events = [];
            results
              .map(function(result) { return angular.element(result.data); })
              .map(function(data) { return data.find('entry'); })
              .forEach(function(calendar) {
                angular.forEach(calendar, function(entry) {
                  var when = entry.getElementsByTagName('gd:when')[0];
                  when = when && when.getAttribute('starttime');
                  scope.events.push(_.zipObject(['title', 'url', 'startDate'], [
                    entry.getElementsByTagName('title')[0].innerText,
                    entry.getElementsByTagName('link')[0].href,
                    when
                  ]));
                });
              });
            scope.setActiveEvents($rootScope.today);
          });
        });
      },
      templateUrl: 'calendar.html'
    };
  }])
  .directive('gmail', ['$http', function($http) {
    return {
      restrict: 'E',
      link: function(scope, element, attrs) {
        $http.get('https://mail.google.com/mail/u/0/feed/atom/')
          .success(function(data) {
            var xml = angular.element(data);
            scope.unreadCount = xml.find('fullcount')[0].innerText;
            element[0].className += ' gmail-visible';
            scope.gmail = true;
          })
          .error(function() {
            element[0].className += ' gmail-visible';
            scope.gmail = false;
            scope.$digest();
          });
      },
      templateUrl: 'gmail.html'
    };
  }]);
