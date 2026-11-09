(() => {
  "use strict";

  const externalLink = (url, label) => {
    const link = document.createElement("a");
    link.href = url;
    link.textContent = label;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  };

  const linkedTitle = (url, label) => {
    if (/^https?:\/\//i.test(url)) return externalLink(url, label);
    const link = document.createElement("a");
    link.href = url;
    link.textContent = label;
    return link;
  };

  const loadJson = async (path) => {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load ${path} (${response.status})`);
    }
    return response.json();
  };

  const showError = (root, message) => {
    root.replaceChildren();
    const notice = document.createElement("p");
    notice.className = "data-error";
    notice.textContent = message;
    root.append(notice);
  };

  const educationList = (items = []) => {
    const list = document.createElement("ul");
    list.className = "education-list";
    items.forEach((item) => {
      const row = document.createElement("li");
      row.textContent = item;
      list.append(row);
    });
    return list;
  };

  const renderPeople = async () => {
    const root = document.querySelector("[data-people]");
    if (!root) return;

    try {
      const data = await loadJson("data/people.json");
      root.replaceChildren();

      const pi = data.principal_investigator;
      const piSection = document.createElement("section");
      piSection.className = "person-section";
      piSection.setAttribute("aria-labelledby", "principal-investigator");
      const piHeading = document.createElement("h2");
      piHeading.className = "section-heading";
      piHeading.id = "principal-investigator";
      piHeading.textContent = "Principal Investigator";

      const piLayout = document.createElement("div");
      piLayout.className = "pi-layout";

      const details = document.createElement("div");
      details.className = "person-details";
      const name = document.createElement("h3");
      name.className = "person-name";
      name.textContent = pi.name;
      const role = document.createElement("p");
      role.className = "person-role";
      role.textContent = pi.role;
      const affiliation = document.createElement("p");
      affiliation.className = "person-affiliation";
      affiliation.textContent = pi.affiliation;
      const links = document.createElement("div");
      links.className = "person-links";
      pi.links.forEach((item) => links.append(externalLink(item.url, item.label)));
      const profileMeta = document.createElement("dl");
      profileMeta.className = "pi-meta";
      const appendProfileMeta = (label, value, href) => {
        if (!value) return;
        const term = document.createElement("dt");
        term.textContent = label;
        const description = document.createElement("dd");
        if (href) {
          const link = document.createElement("a");
          link.href = href;
          link.textContent = value;
          description.append(link);
        } else {
          description.textContent = value;
        }
        profileMeta.append(term, description);
      };
      const appendMailingAddress = (lines = []) => {
        if (!lines.length) return;
        const term = document.createElement("dt");
        term.textContent = "Mailing Address";
        const description = document.createElement("dd");
        const address = document.createElement("address");
        address.className = "mailing-address";
        lines.forEach((line, index) => {
          if (index > 0) address.append(document.createElement("br"));
          address.append(document.createTextNode(line));
        });
        description.append(address);
        profileMeta.append(term, description);
      };
      appendProfileMeta("Email", pi.email, `mailto:${pi.email}`);
      appendProfileMeta("Office", pi.office);
      appendMailingAddress(pi.mailing_address);
      details.append(name, role, affiliation, educationList(pi.training), profileMeta, links);

      if (pi.image) {
        const imageFrame = document.createElement("figure");
        imageFrame.className = "person-image-frame";
        const portrait = document.createElement("img");
        portrait.className = "portrait-image";
        portrait.src = pi.image;
        portrait.alt = pi.name;
        portrait.width = 800;
        portrait.height = 1000;
        portrait.addEventListener("error", () => {
          imageFrame.remove();
          piLayout.classList.add("no-image");
        });
        imageFrame.append(portrait);
        piLayout.append(imageFrame);
      } else {
        piLayout.classList.add("no-image");
      }
      piLayout.append(details);
      piSection.append(piHeading, piLayout);
      root.append(piSection);

      data.groups.forEach((group) => {
        const section = document.createElement("section");
        section.className = "person-section";
        section.setAttribute("aria-labelledby", group.id);
        const heading = document.createElement("h2");
        heading.className = "section-heading";
        heading.id = group.id;
        heading.textContent = group.heading;
        const grid = document.createElement("div");
        grid.className = "people-grid";

        group.people.forEach((person) => {
          const card = document.createElement("article");
          card.className = "person-card";
          if (person.image) {
            const image = document.createElement("img");
            image.className = "person-card-image";
            image.src = person.image;
            image.alt = person.name;
            image.loading = "lazy";
            card.append(image);
          }
          const personName = document.createElement("h3");
          personName.className = "person-name";
          personName.textContent = person.name;
          const personRole = document.createElement("p");
          personRole.className = "person-role";
          personRole.textContent = person.role;
          card.append(personName, personRole, educationList(person.education));
          grid.append(card);
        });

        section.append(heading, grid);
        root.append(section);
      });

      const alumniSection = document.createElement("section");
      alumniSection.className = "person-section";
      alumniSection.setAttribute("aria-labelledby", "alumni");
      const alumniHeading = document.createElement("h2");
      alumniHeading.className = "section-heading";
      alumniHeading.id = "alumni";
      alumniHeading.textContent = "Alumni";
      const tableWrap = document.createElement("div");
      tableWrap.className = "table-wrap";
      tableWrap.tabIndex = 0;
      tableWrap.setAttribute("aria-label", "Alumni table; scroll horizontally if needed");
      const table = document.createElement("table");
      table.innerHTML = "<thead><tr><th scope=\"col\">Name</th><th scope=\"col\">Degree</th><th scope=\"col\">Year</th><th scope=\"col\">Placement</th></tr></thead>";
      const body = document.createElement("tbody");
      data.alumni.forEach((person) => {
        const row = document.createElement("tr");
        [person.name, person.degree, person.year, person.placement].forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.append(cell);
        });
        body.append(row);
      });
      table.append(body);
      tableWrap.append(table);
      alumniSection.append(alumniHeading, tableWrap);
      root.append(alumniSection);
    } catch (error) {
      console.error(error);
      showError(root, "People information could not be loaded. Please try again later.");
    }
  };

  const renderPublications = async () => {
    const root = document.querySelector("[data-publications]");
    if (!root) return;

    try {
      const records = await loadJson("data/publications.json");
      const publications = records
        .filter((item) => item.hidden !== true && Number(item.year) > 0)
        .sort((a, b) => Number(b.year) - Number(a.year) || a.title.localeCompare(b.title));
      root.replaceChildren();

      if (!publications.length) {
        showError(root, "No publications are currently listed.");
        return;
      }

      const byYear = new Map();
      publications.forEach((publication) => {
        const year = String(publication.year);
        if (!byYear.has(year)) byYear.set(year, []);
        byYear.get(year).push(publication);
      });

      const currentYear = String(new Date().getFullYear());
      const defaultOpenYear = byYear.has(currentYear) ? currentYear : byYear.keys().next().value;

      byYear.forEach((items, year) => {
        const section = document.createElement("details");
        section.className = "year-group";
        section.open = year === defaultOpenYear;
        const summary = document.createElement("summary");
        summary.className = "year-summary";
        const label = document.createElement("span");
        label.className = "year-label";
        label.textContent = year;
        const count = document.createElement("span");
        count.className = "year-count";
        count.textContent = `${items.length} ${items.length === 1 ? "publication" : "publications"}`;
        summary.append(label, count);
        const list = document.createElement("ol");
        list.className = "publication-list";

        items.forEach((publication) => {
          const item = document.createElement("li");
          item.className = "publication-item";
          const title = document.createElement("h3");
          title.className = "publication-title";
          if (publication.url) {
            title.append(externalLink(publication.url, publication.title));
          } else {
            title.textContent = publication.title;
          }
          const authors = document.createElement("p");
          authors.className = "publication-authors";
          authors.textContent = publication.authors;
          const venue = document.createElement("p");
          venue.className = "publication-venue";
          venue.textContent = publication.venue;
          item.append(title, authors, venue);
          list.append(item);
        });

        section.append(summary, list);
        root.append(section);
      });
    } catch (error) {
      console.error(error);
      showError(root, "Publications could not be loaded. Please try again later.");
    }
  };

  const renderNews = async () => {
    const root = document.querySelector("[data-news]");
    if (!root) return;

    try {
      const records = await loadJson("data/news.json");
      records.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      root.replaceChildren();
      const list = document.createElement("ol");
      list.className = "news-list";

      records.forEach((record) => {
        const item = document.createElement("li");
        item.className = "news-item";
        const date = document.createElement("time");
        date.className = "news-date";
        date.dateTime = record.date;
        date.textContent = record.date_label;
        const copy = document.createElement("div");
        const title = document.createElement("h2");
        if (record.url) {
          title.append(linkedTitle(record.url, record.title));
        } else {
          title.textContent = record.title;
        }
        const description = document.createElement("p");
        description.textContent = record.description;
        copy.append(title, description);
        item.append(date, copy);
        list.append(item);
      });

      root.append(list);
    } catch (error) {
      console.error(error);
      showError(root, "News could not be loaded. Please try again later.");
    }
  };

  const renderResearch = () => {
    const overview = document.querySelector("[data-research-overview]");
    if (!overview) return;

    const toggles = [...overview.querySelectorAll("[data-research-target]")];
    const details = toggles
      .map((toggle) => document.getElementById(toggle.dataset.researchTarget))
      .filter(Boolean);

    const closeAll = () => {
      toggles.forEach((toggle) => {
        toggle.setAttribute("aria-expanded", "false");
        const indicator = toggle.querySelector(".research-thrust-indicator");
        if (indicator) indicator.textContent = "+";
      });
      details.forEach((detail) => {
        detail.hidden = true;
      });
    };

    toggles.forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const shouldOpen = toggle.getAttribute("aria-expanded") !== "true";
        const detail = document.getElementById(toggle.dataset.researchTarget);
        closeAll();
        if (!shouldOpen || !detail) return;
        toggle.setAttribute("aria-expanded", "true");
        const indicator = toggle.querySelector(".research-thrust-indicator");
        if (indicator) indicator.textContent = "−";
        detail.hidden = false;
      });
    });
  };

  renderResearch();
  renderPeople();
  renderPublications();
  renderNews();
})();
