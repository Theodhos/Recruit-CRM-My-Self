// Page behaviour ported from the original careers page (sidebar, advanced search, job summaries, cookies, go-to-top).
(function ($) {
  'use strict';
  var $sidebar = $('#sidebar'), $overlay = $('.overlay'), $top = $('.js-go-to');

  $('.js-sidebar-collapse').on('click', function () { $sidebar.addClass('active'); $overlay.addClass('active'); });
  $overlay.on('click', function () { $sidebar.removeClass('active'); $overlay.removeClass('active'); });

  $('.js-toggle-advanced-search').on('click', function (e) {
    e.preventDefault();
    $('.js-advanced-search').slideToggle();
    $(this).find('i').toggleClass('fa-angle-down fa-angle-up');
  });

  $('.js-search-query').on('click', '.js-toggle-search-query', function () {
    $('.js-search-query-list').slideToggle();
    $(this).toggleClass('fa-angle-down fa-angle-up');
  });

  $(document).on('click', '.js-toggle-job-summary', function () {
    $(this).find('i').toggleClass('fa-angle-right fa-angle-down');
    $(this).closest('.job').find('.js-summary').slideToggle();
  });

  $top.on('click', function (e) { e.preventDefault(); $('html, body').animate({ scrollTop: 0 }, 600); });
  $(window).on('scroll', function () { $top.toggleClass('show', $(window).scrollTop() > 400); });

  var hideCookies = function () { $('.js-cookies').fadeOut(); };
  $('.js-close-cookies').on('click', function (e) { e.preventDefault(); hideCookies(); });
  $('.js-btn-accept-cookie').on('click', hideCookies);
  $('.js-cookies').on('click', '.custom-checkbox:first', function () {
    alert('Mandatory - can not be deselected. Necessary cookies help make a website usable by enabling basic functions like page navigation and access to secure areas of the website. The website cannot function properly without these cookies.');
  });

  // The filters of the search box. Each one is checked against the jobs themselves (their title, description, requirements,
  // type, place and salary — see data-* on each article); only the jobs that match every filter that is set are shown.
  var $jobs = $('article.job');
  var STOP = { and: 1, the: 1, of: 1, for: 1, to: 1, in: 1, parts: 1, other: 1, sample: 1, only: 1 };
  var CURRENCY = { pound: 'GBP', euro: 'EUR', yuan: 'CNY', rupee: 'INR', yen: 'JPY', won: 'KRW', singd: 'SGD' };

  function words(label) {
    return String(label || '').toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-z0-9]+/).filter(function (w) { return w && !STOP[w] && w.length >= 2; });
  }
  // a text option (Industry, Functional Expertise): the job matches when its text has a significant word of that name
  function hasAnyWord(text, label) {
    var ws = words(label);
    if (!ws.length) return true;
    return ws.some(function (w) {
      if (w.length <= 3) return new RegExp('(^|[^a-z0-9])' + w + '([^a-z0-9]|$)').test(text);
      var stem = w.length > 5 ? w.slice(0, w.length - 2) : w;
      return text.indexOf(stem) > -1;
    });
  }
  function selectedLabel(id) {
    var $o = $(id + ' option:selected');
    return $o.val() ? $.trim($o.text()) : '';
  }
  function keywords() {
    var raw = ($('#inp-keywords').val() || '') + ',' + ($('.bootstrap-tagsinput input').val() || '');
    return raw.toLowerCase().split(/[,\s]+/).filter(Boolean);
  }
  function miles(a, b) {
    var rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  // the place typed in Location, looked up on the map (a UK post code or any place name); kept so it is asked once
  var places = {};
  function locate(text) {
    var key = text.toLowerCase();
    if (places[key] !== undefined) return $.Deferred().resolve(places[key]).promise();
    var done = $.Deferred();
    var pc = /^[a-z]{1,2}\d[a-z\d]?\s?\d[a-z]{2}$/i.test(text.trim());
    var url = pc ? 'https://api.postcodes.io/postcodes/' + encodeURIComponent(text.replace(/\s+/g, '')) : 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(text);
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      var p = pc ? (d.result ? { lat: d.result.latitude, lon: d.result.longitude } : null) : (d[0] ? { lat: +d[0].lat, lon: +d[0].lon } : null);
      places[key] = p; done.resolve(p);
    }).catch(function () { places[key] = null; done.resolve(null); });
    return done.promise();
  }

  function apply(centre) {
    var kw = keywords();
    var loc = ($('#inp-location').val() || '').toLowerCase().trim();
    var radius = +($('#inp-radius').val() || 0);
    var industry = selectedLabel('#inp-industry'), expertise = selectedLabel('#inp-functional_expertises');
    var type = $('#inp-job_type').val(), currency = $('#inp-currency').val(), salaryType = $('#inp-salary_type').val(), interval = $('#inp-pay_interval').val();
    var max = $('#inp-maximum_salary').val() === '' ? null : +$('#inp-maximum_salary').val();
    var min = $('#inp-minimum_salary').val() === '' ? null : +$('#inp-minimum_salary').val();
    var n = 0;
    $jobs.each(function () {
      var $j = $(this), text = $j.data('search') || $j.text().toLowerCase(), ok = true;
      var jType = String($j.data('type') || ''), jMin = $j.data('min'), jMax = $j.data('max');
      var lo = jMin !== undefined && jMin !== '' ? +jMin : null, hi = jMax !== undefined && jMax !== '' ? +jMax : null;
      if (lo === null) lo = hi; if (hi === null) hi = lo;
      // 0 is "no salary written"
      if (!lo && !hi) { lo = null; hi = null; }

      if (kw.length && !kw.every(function (w) { return text.indexOf(w) > -1; })) ok = false;
      if (ok && loc) {
        var hasPoint = $j.data('lat') !== undefined && $j.data('lon') !== undefined;
        if (centre && radius && hasPoint) ok = miles(centre, { lat: +$j.data('lat'), lon: +$j.data('lon') }) <= radius;
        else ok = String($j.data('location') || '').indexOf(loc) > -1 || text.indexOf(loc) > -1;
      }
      if (ok && industry) ok = hasAnyWord(text, industry);
      if (ok && expertise) ok = hasAnyWord(text, expertise);
      if (ok && type) {
        if (type === '1') ok = jType === 'PERMANENT';
        else if (type === '4') ok = jType === 'TEMPORARY';
        else if (type === '2') ok = jType === 'CONTRACT';
        else if (type === '3') ok = /temp[\s-]*to[\s-]*perm/.test(text);
        else if (type === '5') ok = /interim|project|consult/.test(text);
      }
      if (ok && currency) { var code = CURRENCY[currency] || currency.toUpperCase(); ok = String($j.data('currency') || '').toUpperCase() === code; }
      if (ok && salaryType) ok = salaryType === '1' ? /annual|per annum|\bp\.?a\.?\b|per year|yearly|a year/.test(text) : /month|pcm|per calendar month/.test(text);
      if (ok && interval) {
        var words2 = { 1: /hour|hourly|per hr|p\/h/, 2: /day|daily|per day/, 3: /week|weekly/, 4: /month|monthly|pcm/, 5: /annual|year|yearly|per annum/ };
        ok = (words2[interval] || /./).test(text);
      }
      // a salary asked for: the job's range must reach it (a job with no salary shown cannot match)
      if (ok && min !== null) ok = hi !== null && hi >= min;
      if (ok && max !== null) ok = lo !== null && lo <= max;
      $j.toggle(ok);
      if (ok) n++;
    });
    $('.js-num-of-jobs').text(n);
    var $none = $('#no-match');
    if (!$none.length) $none = $('<p id="no-match" class="text-center py-4"></p>').text('No job matches these filters.').insertAfter($jobs.last());
    $none.toggle(n === 0 && $jobs.length > 0);
  }

  function filter() {
    var loc = ($('#inp-location').val() || '').trim(), radius = +($('#inp-radius').val() || 0);
    if (loc && radius) locate(loc).then(apply);
    else apply(null);
  }
  $('.js-search-button').on('click', filter);
  $('.js-search-form').on('submit', function (e) { e.preventDefault(); filter(); });
  $('.js-search-form').on('keydown', 'input', function (e) { if (e.which === 13) { e.preventDefault(); filter(); } });
  // every filter works at once, without pressing search
  $('.js-advanced-search').on('change input', 'select, input', filter);
  $('#inp-keywords').on('change', filter);
  $(document).on('keyup', '.bootstrap-tagsinput input', function () { filter(); });
  $('#inp-location').on('change', filter);
})(jQuery);

// Apply form: posts to this site, which forwards the application to the CRM.
(function ($) {
  $('#applyForm').on('submit', function (e) {
    e.preventDefault();
    var $f = $(this), $btn = $f.find('button[type=submit]').prop('disabled', true), data = new FormData(this);
    var show = function (cls, msg) {
      $f.find('.alert').remove();
      $('<div class="alert mt-3 mb-0" role="alert"></div>').addClass(cls).text(msg).appendTo($f.find('.bg-white').last());
    };
    fetch('/apply/' + $f.data('job'), { method: 'POST', body: data })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (r.ok) { $f[0].reset(); $btn.prop('disabled', false); show('alert-success', 'Your application will be reviewed.'); }
        else { $btn.prop('disabled', false); show('alert-danger', r.error || 'Your application could not be sent. Please check your details and try again.'); }
      })
      .catch(function () { $btn.prop('disabled', false); show('alert-danger', 'Your application could not be sent. Please try again.'); });
  });
})(jQuery);
