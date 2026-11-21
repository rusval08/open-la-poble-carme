const sponsorStrip = document.querySelector('.results-sponsor-strip');
if (sponsorStrip && window.SponsorTicker) {
  window.SponsorTicker.mount(sponsorStrip);
}
