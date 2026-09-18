/* lone-trail — the second panel embeds the video and starts it as soon as the
 * panel is on screen. Browsers only allow unattended autoplay when muted, so
 * the scroll-triggered start is muted and an "unmute" button is offered. */
(function () {
  'use strict';

  var VIDEO_ID = '-s0conum7-Q';
  var ORIGIN = 'https://www.youtube-nocookie.com';

  var section = document.getElementById('watch');
  var player = document.getElementById('player');
  var facade = document.getElementById('facade');
  var soundBtn = document.getElementById('sound-btn');
  if (!section || !player || !facade) return;

  var frame = null;
  var muted = true;

  function src(withSound) {
    var params = [
      'autoplay=1',
      'mute=' + (withSound ? '0' : '1'),
      'playsinline=1',
      'rel=0',
      'modestbranding=1',
      'enablejsapi=1'
    ];
    if (location.protocol === 'https:' || location.protocol === 'http:') {
      params.push('origin=' + encodeURIComponent(location.origin));
    }
    return ORIGIN + '/embed/' + VIDEO_ID + '?' + params.join('&');
  }

  function command(func, args) {
    if (!frame || !frame.contentWindow) return;
    try {
      frame.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: func, args: args || [] }),
        ORIGIN
      );
    } catch (_) { /* player not ready yet */ }
  }

  function load(withSound) {
    if (frame) {
      if (withSound) unmute();
      return;
    }
    muted = !withSound;
    frame = document.createElement('iframe');
    frame.src = src(withSound);
    frame.title = 'lone-trail — embedded video';
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    player.appendChild(frame);
    facade.remove();
    if (soundBtn) soundBtn.hidden = !muted;
  }

  function unmute() {
    command('unMute');
    command('setVolume', [100]);
    command('playVideo');
    muted = false;
    if (soundBtn) soundBtn.hidden = true;
  }

  facade.addEventListener('click', function () { load(true); });
  if (soundBtn) soundBtn.addEventListener('click', unmute);

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.intersectionRatio >= 0.55) {
          if (!frame) load(false);
          else command('playVideo');
        } else if (e.intersectionRatio < 0.2 && frame) {
          command('pauseVideo');
        }
      }
    }, { threshold: [0, 0.2, 0.55, 0.9] });
    io.observe(section);
  }
})();
