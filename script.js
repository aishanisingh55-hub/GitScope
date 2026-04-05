const LANG_COLORS = {
  JavaScript: "#f1e05a", Python: "#3572A5", Java: "#b07219", TypeScript: "#3178c6",
  HTML: "#e34c26", CSS: "#563d7c", "C++": "#f34b7d", C: "#555555",
  "C#": "#178600", Ruby: "#701516", Go: "#00ADD8", Rust: "#dea584",
  PHP: "#4F5D95", Swift: "#F05138", Kotlin: "#A97BFF", Dart: "#00B4AB",
  Shell: "#89e051", Lua: "#000080", R: "#198CE7", Scala: "#c22d40",
  Perl: "#0298c3", Haskell: "#5e5086", Elixir: "#6e4a7e", Vue: "#41b883",
  Jupyter: "#DA5B0B", SCSS: "#c6538c", Makefile: "#427819", Dockerfile: "#384d54",
  Solidity: "#AA6746", Vim: "#199f4b", PowerShell: "#012456", Markdown: "#083fa1"
};

function getLangColor(lang) {
  return LANG_COLORS[lang] || "#8b949e";
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

function formatSize(kb) {
  if (kb >= 1048576) return (kb / 1048576).toFixed(1) + " GB";
  if (kb >= 1024) return (kb / 1024).toFixed(1) + " MB";
  return kb + " KB";
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

const dom = {
  searchInput: document.getElementById("searchInput"),
  searchBtn: document.getElementById("searchBtn"),
  errorMsg: document.getElementById("errorMsg"),
  results: document.getElementById("results"),
  loader: document.getElementById("loader"),
  suggestions: document.getElementById("suggestions"),
  avatar: document.getElementById("avatar"),
  profileName: document.getElementById("profileName"),
  profileUsername: document.getElementById("profileUsername"),
  profileBio: document.getElementById("profileBio"),
  metaLocation: document.getElementById("metaLocation"),
  locationText: document.getElementById("locationText"),
  metaCompany: document.getElementById("metaCompany"),
  companyText: document.getElementById("companyText"),
  metaBlog: document.getElementById("metaBlog"),
  blogLink: document.getElementById("blogLink"),
  metaJoined: document.getElementById("metaJoined"),
  joinedText: document.getElementById("joinedText"),
  repoCount: document.getElementById("repoCount"),
  followerCount: document.getElementById("followerCount"),
  followingCount: document.getElementById("followingCount"),
  gistCount: document.getElementById("gistCount"),
  profileLink: document.getElementById("profileLink"),
  langBar: document.getElementById("langBar"),
  langList: document.getElementById("langList"),
  totalStars: document.getElementById("totalStars"),
  totalForks: document.getElementById("totalForks"),
  totalWatchers: document.getElementById("totalWatchers"),
  totalSize: document.getElementById("totalSize"),
  repoBadge: document.getElementById("repoBadge"),
  reposGrid: document.getElementById("reposGrid"),
  sortSelect: document.getElementById("sortSelect")
};

let allRepos = [];
let searchDebounceTimer = null;
let activeSuggestionIndex = -1;
let currentSuggestions = [];

// ── SEARCH SUGGESTIONS ──────────────────────────────────────────

async function fetchSuggestions(query) {
  if (!query || query.length < 2) {
    hideSuggestions();
    return;
  }

  try {
    const res = await fetch(`https://api.github.com/search/users?q=${encodeURIComponent(query)}&per_page=8`);
    if (!res.ok) return;
    const data = await res.json();
    currentSuggestions = data.items || [];
    renderSuggestions(currentSuggestions);
  } catch (e) {
    // silently fail suggestions
  }
}

function renderSuggestions(users) {
  if (!users.length) {
    hideSuggestions();
    return;
  }

  dom.suggestions.innerHTML = "";
  activeSuggestionIndex = -1;

  users.forEach((user, index) => {
    const item = document.createElement("div");
    item.className = "suggestion-item";
    item.dataset.index = index;
    item.innerHTML = `
      <img class="suggestion-avatar" src="${escapeHtml(user.avatar_url)}" alt="${escapeHtml(user.login)}" />
      <div class="suggestion-info">
        <span class="suggestion-login">${escapeHtml(user.login)}</span>
        <span class="suggestion-type">${user.type === "Organization" ? "🏢 Organization" : "👤 User"}</span>
      </div>
      <span class="suggestion-arrow">↗</span>
    `;

    item.addEventListener("mousedown", (e) => {
      e.preventDefault(); // prevent blur before click fires
      selectSuggestion(user.login);
    });

    dom.suggestions.appendChild(item);
  });

  dom.suggestions.classList.remove("hidden");
}

function hideSuggestions() {
  dom.suggestions.classList.add("hidden");
  dom.suggestions.innerHTML = "";
  activeSuggestionIndex = -1;
  currentSuggestions = [];
}

function selectSuggestion(login) {
  dom.searchInput.value = login;
  hideSuggestions();
  fetchProfile(login);
}

function highlightSuggestion(index) {
  const items = dom.suggestions.querySelectorAll(".suggestion-item");
  items.forEach((el, i) => {
    el.classList.toggle("active", i === index);
  });
}

// ── KEYBOARD NAVIGATION ──────────────────────────────────────────

dom.searchInput.addEventListener("keydown", (e) => {
  const items = dom.suggestions.querySelectorAll(".suggestion-item");

  if (!dom.suggestions.classList.contains("hidden") && items.length > 0) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, items.length - 1);
      highlightSuggestion(activeSuggestionIndex);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, -1);
      highlightSuggestion(activeSuggestionIndex);
      return;
    }
    if (e.key === "Enter") {
      if (activeSuggestionIndex >= 0 && currentSuggestions[activeSuggestionIndex]) {
        selectSuggestion(currentSuggestions[activeSuggestionIndex].login);
        return;
      }
    }
    if (e.key === "Escape") {
      hideSuggestions();
      return;
    }
  }

  if (e.key === "Enter") handleSearch();
});

dom.searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounceTimer);
  const query = dom.searchInput.value.trim();
  searchDebounceTimer = setTimeout(() => fetchSuggestions(query), 280);
});

dom.searchInput.addEventListener("blur", () => {
  // Small delay to allow mousedown on suggestion to fire first
  setTimeout(hideSuggestions, 150);
});

// ── PROFILE FETCH ──────────────────────────────────────────

async function fetchProfile(username) {
  hideSuggestions();
  dom.results.classList.add("hidden");
  dom.errorMsg.classList.add("hidden");
  dom.loader.classList.remove("hidden");

  try {
    const userRes = await fetch(`https://api.github.com/users/${username}`);
    if (!userRes.ok) {
      if (userRes.status === 404) throw new Error("User not found. Check the username and try again.");
      if (userRes.status === 403) throw new Error("API rate limit exceeded. Please wait a minute and try again.");
      throw new Error("Something went wrong. Please try again.");
    }
    const user = await userRes.json();

    let repos = [];
    let page = 1;
    while (true) {
      const repoRes = await fetch(`https://api.github.com/users/${username}/repos?per_page=100&page=${page}`);
      if (!repoRes.ok) break;
      const batch = await repoRes.json();
      if (batch.length === 0) break;
      repos = repos.concat(batch);
      if (batch.length < 100) break;
      page++;
    }

    allRepos = repos;
    renderProfile(user);
    renderLanguages(repos);
    renderRepoStats(repos);
    renderRepos(repos);

    dom.loader.classList.add("hidden");
    dom.results.classList.remove("hidden");

  } catch (err) {
    dom.loader.classList.add("hidden");
    dom.errorMsg.textContent = err.message;
    dom.errorMsg.classList.remove("hidden");
  }
}

function renderProfile(user) {
  dom.avatar.src = user.avatar_url;
  dom.profileName.textContent = user.name || user.login;
  dom.profileUsername.textContent = "@" + user.login;
  dom.profileBio.textContent = user.bio || "No bio available.";

  if (user.location) {
    dom.locationText.textContent = user.location;
    dom.metaLocation.classList.remove("hidden");
  } else {
    dom.metaLocation.classList.add("hidden");
  }

  if (user.company) {
    dom.companyText.textContent = user.company;
    dom.metaCompany.classList.remove("hidden");
  } else {
    dom.metaCompany.classList.add("hidden");
  }

  if (user.blog) {
    let blog = user.blog;
    if (!blog.startsWith("http")) blog = "https://" + blog;
    dom.blogLink.href = blog;
    dom.blogLink.textContent = user.blog;
    dom.metaBlog.classList.remove("hidden");
  } else {
    dom.metaBlog.classList.add("hidden");
  }

  dom.joinedText.textContent = "Joined " + formatDate(user.created_at);
  dom.repoCount.textContent = formatNumber(user.public_repos);
  dom.followerCount.textContent = formatNumber(user.followers);
  dom.followingCount.textContent = formatNumber(user.following);
  dom.gistCount.textContent = formatNumber(user.public_gists);
  dom.profileLink.href = user.html_url;
}

function renderLanguages(repos) {
  const langMap = {};
  repos.forEach(repo => {
    if (repo.language) {
      langMap[repo.language] = (langMap[repo.language] || 0) + 1;
    }
  });

  const sorted = Object.entries(langMap).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, count]) => sum + count, 0);
  const top = sorted.slice(0, 8);

  dom.langBar.innerHTML = "";
  dom.langList.innerHTML = "";

  if (top.length === 0) {
    dom.langBar.innerHTML = '<div style="flex:1;background:var(--bg-card);border-radius:5px;"></div>';
    dom.langList.innerHTML = '<span class="lang-item" style="color:var(--text-muted);">No language data</span>';
    return;
  }

  top.forEach(([lang, count]) => {
    const pct = ((count / total) * 100).toFixed(1);
    const color = getLangColor(lang);

    const seg = document.createElement("div");
    seg.className = "lang-bar-segment";
    seg.style.width = pct + "%";
    seg.style.background = color;
    seg.title = lang + " " + pct + "%";
    dom.langBar.appendChild(seg);

    const item = document.createElement("div");
    item.className = "lang-item";
    item.innerHTML =
      '<span class="lang-dot" style="background:' + color + '"></span>' +
      '<span>' + escapeHtml(lang) + '</span>' +
      '<span class="lang-percent">' + pct + '%</span>';
    dom.langList.appendChild(item);
  });
}

function renderRepoStats(repos) {
  let stars = 0, forks = 0, watchers = 0, size = 0;
  repos.forEach(repo => {
    stars += repo.stargazers_count || 0;
    forks += repo.forks_count || 0;
    watchers += repo.watchers_count || 0;
    size += repo.size || 0;
  });

  dom.totalStars.textContent = formatNumber(stars);
  dom.totalForks.textContent = formatNumber(forks);
  dom.totalWatchers.textContent = formatNumber(watchers);
  dom.totalSize.textContent = formatSize(size);
}

function sortRepos(repos, sortBy) {
  const copy = [...repos];
  switch (sortBy) {
    case "stars":
      return copy.sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0));
    case "forks":
      return copy.sort((a, b) => (b.forks_count || 0) - (a.forks_count || 0));
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "updated":
    default:
      return copy.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }
}

function renderRepos(repos) {
  const sorted = sortRepos(repos, dom.sortSelect.value);
  dom.repoBadge.textContent = repos.length;
  dom.reposGrid.innerHTML = "";

  sorted.forEach(repo => {
    const card = document.createElement("div");
    card.className = "repo-card";

    let metaHtml = "";

    if (repo.language) {
      metaHtml += '<div class="repo-meta-item">' +
        '<span class="repo-lang-dot" style="background:' + getLangColor(repo.language) + '"></span>' +
        '<span>' + escapeHtml(repo.language) + '</span></div>';
    }

    if (repo.stargazers_count > 0) {
      metaHtml += '<div class="repo-meta-item repo-star">★ ' + formatNumber(repo.stargazers_count) + '</div>';
    }

    if (repo.forks_count > 0) {
      metaHtml += '<div class="repo-meta-item repo-fork">⑂ ' + formatNumber(repo.forks_count) + '</div>';
    }

    metaHtml += '<div class="repo-meta-item">Updated ' + formatDate(repo.updated_at) + '</div>';

    if (repo.fork) {
      metaHtml += '<span class="fork-badge">Fork</span>';
    }

    card.innerHTML =
      '<a class="repo-name" href="' + repo.html_url + '" target="_blank">' + escapeHtml(repo.name) + '</a>' +
      '<p class="repo-desc">' + (repo.description ? escapeHtml(repo.description) : '<em style="color:var(--text-muted)">No description</em>') + '</p>' +
      '<div class="repo-meta">' + metaHtml + '</div>';

    dom.reposGrid.appendChild(card);
  });
}

function handleSearch() {
  const username = dom.searchInput.value.trim();
  if (!username) return;
  fetchProfile(username);
}

dom.searchBtn.addEventListener("click", handleSearch);

dom.sortSelect.addEventListener("change", () => {
  if (allRepos.length > 0) renderRepos(allRepos);
});

dom.searchInput.focus();
