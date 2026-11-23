const sponsorStrip = document.querySelector('.results-sponsor-strip');
if (sponsorStrip && window.SponsorTicker) {
  const list = document.createElement('ul');
  list.className = 'results-sponsor-list';
  list.setAttribute('aria-label', 'Patrocinadors del campionat');
  list.tabIndex = 0;
  for (const sponsor of window.SponsorTicker.catalog) {
    const item = document.createElement('li');
    item.append(window.SponsorTicker.logo([sponsor.name, ...sponsor.crop]));
    list.append(item);
  }
  sponsorStrip.append(list);
  sponsorStrip.closest('.results-sponsors').classList.add('has-sponsor-list');
}
