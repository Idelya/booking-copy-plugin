(function initBookingExcelCopyLocalization() {
  const namespace = window.BookingExcelCopy || {};
  const utils = namespace.utils || {};
  const getText = utils.getText;
  const parsePositiveInt = utils.parsePositiveInt;
  const debugLog = utils.debugLog;

  function getApartmentLocalization() {
    const normalize = (value) => (value || "").replace(/\s+/g, " ").trim();
    const getVisibleNodeText = (node) => {
      if (!node) {
        return "";
      }
      const clone = node.cloneNode(true);
      const hiddenNodes = clone.querySelectorAll('[aria-hidden="true"], [hidden]');
      hiddenNodes.forEach((hiddenNode) => hiddenNode.remove());
      return normalize(clone.textContent || "");
    };
    const getMapHeaderAddress = () => {
      const mapHeaderLink = document.querySelector("#map_trigger_header");
      if (!mapHeaderLink) {
        return "";
      }

      const wrapper = mapHeaderLink.closest(
        '[data-testid="PropertyHeaderAddressDesktop-wrapper"], [data-testid="PropertyHeaderAddressDesktop"], [data-testid="PropertyHeaderAddress"]'
      );
      if (!wrapper) {
        return "";
      }

      const buttonNode = wrapper.querySelector("button");
      const labelNode = buttonNode ? buttonNode.querySelector("div") : null;
      return getVisibleNodeText(labelNode || buttonNode);
    };
    const sanitizeLocalization = (value) => {
      const normalized = normalize(value);
      if (!normalized) {
        return "";
      }

      // Language-agnostic cleanup: normalize merged words and keep the address-like lead part.
      let cleaned = normalized
        .replace(/([a-z\u00c0-\u024f])([A-Z\u00c0-\u024f])/g, "$1 $2")
        .split(/[\n\r|•]/)[0];
      cleaned = cleaned.replace(/\s*[–-]\s*(?:Świetna lokalizacja|Znakomita lokalizacja|Great location|Excellent location|pokaż mapę|show map|see map|sprawdź lokalizacj[ęe]).*$/i, "");
      cleaned = cleaned.replace(/\b(?:Świetna lokalizacja|Znakomita lokalizacja|Great location|Excellent location)\b.*$/i, "");
      cleaned = cleaned.replace(/[–-]\s*$/g, "");
      cleaned = cleaned.replace(/\s*,\s*$/g, "");
      cleaned = cleaned.replace(/\s+/g, " ").trim();
      if (!cleaned) {
        return "";
      }

      const rawParts = cleaned
        .split(",")
        .map((part) => normalize(part))
        .filter(Boolean);
      const dedupedParts = [];
      let primaryStreetLower = "";

      for (const part of rawParts) {
        const sentenceHead = normalize(String(part).split(/[!?]/)[0]);
        if (!sentenceHead) {
          continue;
        }
        if (/\b(?:Świetna lokalizacja|Znakomita lokalizacja|Great location|Excellent location|pokaż mapę|show map|see map|sprawdź lokalizacj[ęe])\b/i.test(sentenceHead)) {
          continue;
        }
        const words = sentenceHead.split(" ").filter(Boolean);
        const hasDigit = /\d/.test(sentenceHead);
        if (!hasDigit && words.length > 8) {
          continue;
        }
        const lowerPart = sentenceHead.toLowerCase();

        if (!primaryStreetLower && /\b(?:ul\.|al\.|plac|street|st\.|avenue|ave\.)\b/i.test(sentenceHead)) {
          primaryStreetLower = lowerPart;
        }
        if (primaryStreetLower && lowerPart !== primaryStreetLower && lowerPart.includes(primaryStreetLower)) {
          continue;
        }

        let shouldSkip = false;
        for (let i = 0; i < dedupedParts.length; i += 1) {
          const existing = dedupedParts[i];
          const lowerExisting = existing.toLowerCase();
          if (lowerPart === lowerExisting || lowerPart.includes(lowerExisting)) {
            shouldSkip = true;
            break;
          }
          if (lowerExisting.includes(lowerPart)) {
            dedupedParts[i] = sentenceHead;
            shouldSkip = true;
            break;
          }
        }
        if (!shouldSkip) {
          dedupedParts.push(sentenceHead);
        }
      }

      return dedupedParts.join(", ");
    };

    const getJsonLdLocation = () => {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const scriptNode of scripts) {
        const raw = scriptNode.textContent;
        if (!raw) {
          continue;
        }
        try {
          const parsed = JSON.parse(raw);
          const nodes = Array.isArray(parsed)
            ? parsed
            : parsed && Array.isArray(parsed["@graph"])
              ? parsed["@graph"]
              : [parsed];
          for (const node of nodes) {
            if (!node || typeof node !== "object") {
              continue;
            }
            const address = node.address;
            if (!address || typeof address !== "object") {
              continue;
            }
            const street = normalize(address.streetAddress);
            const district = normalize(address.addressLocality);
            const city = normalize(address.addressCity || address.city || address.locality);
            const region = normalize(address.addressRegion);
            const postalCode = normalize(address.postalCode);
            const country = normalize(address.addressCountry);
            const locality = normalize(address.addressLocality);
            const parts = [locality, region, country].filter(Boolean);
            const streetPostalCity = [street, [postalCode, city || district].filter(Boolean).join(" ")].filter(Boolean).join(", ");
            const streetDistrictPostalCity = [
              street,
              district,
              [postalCode, city || district].filter(Boolean).join(" ")
            ].filter(Boolean).join(", ");
            if (parts.length) {
              return {
                city: city || locality || district,
                full: parts.join(", "),
                streetPostalCity,
                streetDistrictPostalCity
              };
            }
          }
        } catch (_error) {
          // Ignore invalid JSON-LD blocks.
        }
      }
      return { city: "", full: "", streetPostalCity: "", streetDistrictPostalCity: "" };
    };

    const scoreLocalization = (value) => {
      if (!value) {
        return -999;
      }
      let score = 0;
      if (/\b\d{2}-\d{3}\b/.test(value)) {
        score += 8; // Postal code strongly suggests full address with city.
      }
      if (value.includes(",")) {
        score += Math.min(4, value.split(",").length - 1);
      }
      if (/[A-Za-z]\s+\d/.test(value) || /\b(?:ul\.|al\.|plac|street|st\.|avenue|ave\.)\b/i.test(value)) {
        score += 2;
      }
      return score + Math.min(6, Math.floor(value.length / 22));
    };

    const tooltipNode = document.querySelector('[data-node_tt_id="location_score_tooltip"]');
    const tooltipText = tooltipNode
      ? normalize(
        tooltipNode.getAttribute("data-tooltip-text")
          || tooltipNode.getAttribute("aria-label")
          || tooltipNode.textContent
      )
      : "";

    const visibleText = getText([
      '[data-testid="LocationScoreBadge"]',
      '[data-testid="review-location-score"]',
      '[data-testid="PropertyHeaderAddressDesktop"] [aria-label*="location"]',
      '[data-testid="PropertyHeaderAddress"] [aria-label*="location"]',
      '[data-testid="PropertyHeaderAddressDesktop"] [aria-label*="lokaliz" i]',
      '[data-testid="PropertyHeaderAddress"] [aria-label*="lokaliz" i]',
      'a[data-atlas-latlng][title]'
    ]);

    const semanticAddressSelectors = [
      '[data-capla-component-boundary*="PropertyHeaderAddress"]',
      '[data-testid="PropertyHeaderAddressDesktop"]',
      '[data-testid="PropertyHeaderAddressDesktop-wrapper"]',
      '[data-testid="PropertyHeaderAddress"]',
      '[data-testid="location-block-container"]',
      'a[data-atlas-latlng][title]',
      '[id="map_trigger_header"]',
      '[id="map_trigger_header_pin"]',
      '[data-testid*="Address"]',
      '[data-testid*="address"]',
      '[itemprop="address"]',
      '[itemprop="streetAddress"]',
      '[itemprop="addressLocality"]',
      '[itemprop="postalCode"]',
      '[itemprop="addressCountry"]'
    ];
    const addressNodes = Array.from(
      document.querySelectorAll(
        semanticAddressSelectors.join(",")
      )
    );
    const addressCandidates = [];
    const pushCandidate = (value) => {
      const normalized = normalize(value);
      if (normalized) {
        addressCandidates.push(normalized);
      }
    };

    const ogTitle = document.querySelector('meta[property="og:title"]');
    pushCandidate(ogTitle ? ogTitle.getAttribute("content") : "");
    const mapHeaderAddress = normalize(getMapHeaderAddress());
    pushCandidate(mapHeaderAddress);

    if (mapHeaderAddress) {
      return mapHeaderAddress;
    }

    for (const node of addressNodes) {
      pushCandidate(getVisibleNodeText(node));
      pushCandidate(node.getAttribute("aria-label"));
      pushCandidate(node.getAttribute("data-tooltip-text"));
      pushCandidate(node.getAttribute("title"));
      pushCandidate(node.getAttribute("data-address"));
    }
    const cleanAddressCandidates = addressCandidates
      .map((candidate) => sanitizeLocalization(candidate))
      .filter(Boolean);
    const headerAddress = cleanAddressCandidates.sort((a, b) => scoreLocalization(b) - scoreLocalization(a))[0] || "";

    const jsonLdLocation = getJsonLdLocation();
    const cityLower = jsonLdLocation.city.toLowerCase();
    const bestLabel = [
      sanitizeLocalization(tooltipText),
      sanitizeLocalization(visibleText),
      sanitizeLocalization(headerAddress),
      sanitizeLocalization(jsonLdLocation.streetDistrictPostalCity),
      sanitizeLocalization(jsonLdLocation.streetPostalCity)
    ]
      .filter(Boolean)
      .sort((a, b) => scoreLocalization(b) - scoreLocalization(a))[0] || "";
    if (bestLabel) {
      if (cityLower && !bestLabel.toLowerCase().includes(cityLower)) {
        return `${bestLabel}, ${jsonLdLocation.city}`;
      }
      return bestLabel;
    }

    return sanitizeLocalization(jsonLdLocation.full);
  }

  function isOfferPage() {
    return /\/hotel\//i.test(window.location.pathname);
  }

  function getShortShareLink() {
    if (/\/share-/i.test(window.location.pathname)) {
      return window.location.href;
    }

    const shareFieldSelectors = [
      'input[value*="/Share-"]',
      'input[value*="/share-"]',
      'textarea:where([value*="/Share-"], [value*="/share-"])',
      'a[href*="/Share-"]',
      'a[href*="/share-"]'
    ];

    for (const selector of shareFieldSelectors) {
      const node = document.querySelector(selector);
      if (!node) {
        continue;
      }

      const rawValue = node.value || node.href || "";
      if (rawValue && /booking\.com\/share-/i.test(rawValue)) {
        return rawValue.trim();
      }
    }

    const dataShareNode = document.querySelector('[data-share-url*="booking.com"]');
    if (dataShareNode) {
      const raw = dataShareNode.getAttribute("data-share-url");
      if (raw && /booking\.com\/share-/i.test(raw)) {
        return raw.trim();
      }
    }

    return "";
  }

  function getCanonicalLink() {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical && canonical.href) {
      return canonical.href;
    }
    return "";
  }

  function parseRequiredGuests() {
    const params = new URLSearchParams(window.location.search);
    const groupAdults = parsePositiveInt(params.get("group_adults"));
    const groupChildren = parsePositiveInt(params.get("group_children"));
    const directAdults = parsePositiveInt(params.get("adults"));
    const directChildren = parsePositiveInt(params.get("children"));

    let totalGuests = groupAdults + groupChildren;
    if (!totalGuests) {
      totalGuests = directAdults + directChildren;
    }

    if (!totalGuests) {
      for (const [key, value] of params.entries()) {
        if (!/^room\d+$/i.test(key) || !value) {
          continue;
        }
        const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
        if (parts.length) {
          totalGuests += parts.length;
        }
      }
    }

    const resolvedGuests = totalGuests > 0 ? totalGuests : 1;
    
    return resolvedGuests;
  }

  namespace.localization = Object.assign({}, namespace.localization, {
    getApartmentLocalization,
    isOfferPage,
    getShortShareLink,
    getCanonicalLink,
    parseRequiredGuests
  });

  window.BookingExcelCopy = namespace;
})();
