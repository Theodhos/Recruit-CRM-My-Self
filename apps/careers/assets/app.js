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

  // Client-side keyword / location filter over the job list.
  var $jobs = $('article.job');
  function filter() {
    var kw = ($('#inp-keywords').val() || $('.bootstrap-tagsinput input').val() || '').toLowerCase().trim();
    var loc = ($('#inp-location').val() || '').toLowerCase().trim();
    var n = 0;
    $jobs.each(function () {
      var $j = $(this);
      var ok = (!kw || $j.text().toLowerCase().indexOf(kw) > -1) && (!loc || $j.find('.job__location').text().toLowerCase().indexOf(loc) > -1);
      $j.toggle(ok); if (ok) n++;
    });
    $('.js-num-of-jobs').text(n);
  }
  $('.js-search-button').on('click', filter);
  $('#inp-location, .bootstrap-tagsinput input').on('keydown', function (e) { if (e.which === 13) { e.preventDefault(); filter(); } });
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
        else { $btn.prop('disabled', false); show('alert-danger', 'Your application could not be sent. Please check your details and try again.'); }
      })
      .catch(function () { $btn.prop('disabled', false); show('alert-danger', 'Your application could not be sent. Please try again.'); });
  });
})(jQuery);
