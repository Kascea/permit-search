# Twin Cities permit portals

This is a map of the permit software each Twin Cities metro city uses, for
planning which systems to integrate with for permit status lookups.

Researched November 3, 2026. City sites were crawled for links to known
permit-system vendors. Where a site blocked the crawler, the city was looked
up through web search instead. Cities switch systems without warning; St. Paul
replaced its whole system in September 2025. Re-check a city before building
against it.

**Confidence**
- **High**: the portal was opened directly, or a portal URL was found on the
  city's own site.
- **Medium**: named on the city's site, but the portal itself wasn't opened.
- **Low**: comes from an older document or a third-party source.

## Cities by system

| System | Cities | Count |
|---|---|---|
| LOGIS ePermits | Apple Valley, Crystal, Eden Prairie, Edina, Farmington, Golden Valley, Maple Grove, Minnetonka, New Hope, Ramsey, Savage, South St. Paul, St. Louis Park, White Bear Lake | 14 |
| BS&A Online | Plymouth, Coon Rapids, Lakeville, Chanhassen, Shoreview, Prior Lake, Lino Lakes, Mounds View | 8 |
| Tyler EnerGov (Civic Access) | St. Paul, Woodbury, Shakopee, Cottage Grove, Columbia Heights | 5 |
| Tyler eSuite | Brooklyn Park | 1 |
| iMS | Blaine, Brooklyn Center | 2 |
| Accela | Roseville, Maplewood | 2 |
| CityView | Bloomington, Inver Grove Heights | 2 |
| OpenGov | Burnsville, Oakdale | 2 |
| SmartGov | Chaska, Hastings | 2 |
| CitizenServe | Elk River, Richfield | 2 |
| CentralSquare eTRAKiT | West St. Paul | 1 |
| LAMA | Eagan | 1 |
| Unidentified or not a single portal | Minneapolis, Fridley, Champlin, Stillwater, Anoka, Andover, Rosemount, Hopkins, Ham Lake, New Brighton | 10 |

## City reference

| City | System | Portal | Confidence | Notes |
|---|---|---|---|---|
| Minneapolis | None (several tools) | [Tableau permit search](https://tableau.minneapolismn.gov/views/PermitSearch/PermitSearch) | Medium | Building permits are fillable PDFs sent by email. A city-built online system handles some simple trade permits. ProjectDox is used for plan review. Third-party sites cite daily-updated permit data, which points to an open-data feed (not verified). |
| St. Paul | Tyler EnerGov | `cityofstpaulmn-energovweb.tylerhost.net/apps/selfservice` | High | Branded as PAULIE, live since September 17, 2025. Replaced AMANDA and ECLIPS. The public search API was tested and works. |
| Woodbury | Tyler EnerGov | Tyler Civic Access | Medium | The city says a Tyler Civic Access login from another city works here too. |
| Shakopee | Tyler EnerGov | `shakopeemn-energovpub.tylerhost.net/apps/selfservice` | High | |
| Cottage Grove | Tyler EnerGov | `eplcss.cottagegrovemn.gov/energov_prod/selfservice` | High | Hosted by the city, not by Tyler |
| Columbia Heights | Tyler EnerGov | `cityofcolumbiaheightsmn-energovweb.tylerhost.net/apps/selfservice` | High | |
| Brooklyn Park | Tyler eSuite | [esuite.brooklynpark.org](https://esuite.brooklynpark.org/eSuite.Permits/WelcomePage.aspx) | High | Public search by permit type, number or address. Not EnerGov, so it doesn't use the same API. |
| Apple Valley | LOGIS ePermits | [epermits.logis.org?city=av](https://epermits.logis.org/home.aspx?city=av) | High | ProjectDox (Avolve) for plan review |
| Crystal | LOGIS ePermits | `epermits.logis.org/home.aspx?city=cy` | High | |
| Eden Prairie | LOGIS ePermits | `epermits.logis.org/home.aspx?city=ep` | High | ProjectDox for plan review. Electrical permits go through the state. |
| Edina | LOGIS ePermits | `epermits.logis.org/home.aspx?city=ed` | High | |
| Farmington | LOGIS ePermits | `epermits.logis.org/home.aspx?city=fa` | Medium | Also links to BS&A, possibly for utility billing |
| Golden Valley | LOGIS ePermits | `epermits.logis.org/home.aspx?city=gv` | High | |
| Maple Grove | LOGIS ePermits | `epermits.logis.org/home.aspx?city=mg` | High | ProjectDox at `planreview.maplegrovemn.gov` |
| Minnetonka | LOGIS ePermits | `epermits.logis.org/home.aspx?city=mi` | High | |
| New Hope | LOGIS ePermits | `epermits.logis.org/home.aspx?city=nh` | Medium | The city's site links here, but New Hope isn't on the LOGIS city list. It also links to BS&A. |
| Ramsey | LOGIS ePermits | `epermits.logis.org/home.aspx?city=ra` | High | |
| Savage | LOGIS ePermits | `epermits.logis.org/home.aspx?city=sa` | High | |
| South St. Paul | LOGIS ePermits | `epermits.logis.org/home.aspx?city=ss` | High | |
| St. Louis Park | LOGIS ePermits | `epermits.logis.org/home.aspx?city=sl` | High | ProjectDox for plan review |
| White Bear Lake | LOGIS ePermits | `epermits.logis.org/home.aspx?city=wb` | High | |
| Plymouth | BS&A Online | [bsaonline.com uid 2691](https://bsaonline.com/DirectUrl/Cd_PermitApplication/2691) | High | Only simple residential permits can be filed online |
| Coon Rapids | BS&A Online | `bsaonline.com` | High | |
| Lakeville | BS&A Online | `bsaonline.com/?uid=3059` | Medium | |
| Chanhassen | BS&A Online | `bsaonline.com` | Medium | Contractors must register. Inspections can be requested online. |
| Shoreview | BS&A Online | `bsaonline.com` | Medium | Contractors need a web PIN from the city |
| Prior Lake | BS&A Online | `bsaonline.com/?uid=2413` | Low | The link may be for utility billing |
| Lino Lakes | BS&A Online | `bsaonline.com/?uid=3141` | Low | The only link found was a bill-payment page |
| Mounds View | BS&A Online | `bsaonline.com` | High | Links to a permit application |
| Blaine | iMS | City iMS portal ([help page](https://www.blainemn.gov/3033/iMS-Help)) | High | Live since October 2020. Linked to state (DLI) license records. |
| Brooklyn Center | iMS | City iMS portal | High | Public search by permit number, address or contractor |
| Roseville | Accela | `aca3.accela.com/roseville_mn/` | High | |
| Maplewood | Accela | `maplewoodmn.gov/ACA` | Medium | |
| Bloomington | CityView | [permits.bloomingtonmn.gov/prodportal](https://permits.bloomingtonmn.gov/prodportal) | High | Public locator at `/Permit/Locator`. Paper applications are no longer accepted. |
| Inver Grove Heights | CityView | `cv.ighmn.gov/CityViewPortal/` | High | |
| Burnsville | OpenGov | `burnsvillemn.portal.opengov.com` | High | |
| Oakdale | OpenGov | `oakdalemn.portal.opengov.com` | High | |
| Chaska | SmartGov | `ci-chaska-mn.smartgovcommunity.com/Public/Home` | High | |
| Hastings | SmartGov | `ci-hastings-mn.smartgovcommunity.com/Public/Home` | High | |
| Elk River | CitizenServe | `www3.citizenserve.com/Portal/?installationid=323` | High | |
| Richfield | CitizenServe | City online portal | Low | Based on an older city PDF; the current portal wasn't checked |
| West St. Paul | CentralSquare eTRAKiT | `wspmn.csqrcloud.com/community-etrakit/` | High | |
| Eagan | LAMA | `eagan.onlama.com` | Medium | All applications must go through the portal |
| Fridley | Unknown | City "E-Permit" portal | Low | Online filing is required; the vendor wasn't identified |
| Champlin | Unknown | City online permits page | Low | Downloadable PDF application. May use BS&A. |
| Stillwater, Anoka, Andover, Rosemount, Hopkins, Ham Lake, New Brighton | Unknown | — | — | Not identified. Most link to the state DLI for electrical permits. |

## Integration notes by system

### Tyler EnerGov (5 cities)
- **How to read data:** an open JSON API at `POST {host}/apps/selfservice/api/energov/search/search`. It needs `tenantId` and `tenantName` headers.
- **Finding the tenant name:** `GET {host}/apps/selfservice/api/tenants/gettenantslist` returns it with no login. St. Paul's is `cityofstpaulmnprod`.
- **What's been tested:** only St. Paul. A search for "Ford Pkwy" returned 4,724 records, each with permit number, type, status, address, and apply and issue dates.
- **Next step:** check that the same request works on the other four hosts. EnerGov is common nationally, so this code carries over to other states.

### LOGIS ePermits (14 cities)
- **How to read data:** one ASP.NET WebForms site, with each city selected by `?city=` code. Anyone can search by address or permit number and see inspection results.
- **Scraping:** it means handling the site's hidden form state (`__VIEWSTATE` and postbacks).
- **Partnership:** LOGIS is a public cooperative of Minnesota cities, not a software company. Asking it for data access is a realistic alternative to scraping.

### BS&A Online (8 cities)
- **How to read data:** one hosted site at `bsaonline.com`, with each city identified by `uid`.
- **Terms of use:** the [terms](https://bsaonline.com/TermsOfUse/BsaoTermsOfUse) ban bots, scraping and browser add-ons. They also ban commercial use, and even commercial linking, without written consent from BS&A Software.
- **Bot protection:** the public record search is protected by Google's invisible CAPTCHA (reCAPTCHA v3).
- **What this means:** don't integrate, even read-only, until BS&A gives written consent. Until then, users check status on the city's site themselves.
- **Also verify:** some of the `uid` links found point to utility billing, not permits (see Prior Lake, Lino Lakes, Farmington and New Hope).

### Systems with two or fewer cities (Accela, CityView, OpenGov, SmartGov, iMS, CitizenServe, eTRAKiT, LAMA, Tyler eSuite)
- All of these have public search pages.
- **Accela** also offers the Construct API. It has an anonymous mode that some cities enable.
- **CityView** has a predictable locator path, `/Permit/Locator`.
- **Suggested approach for now:** deep-link users to each city's status search, and build a full integration only when demand justifies it.

### Minneapolis
- There's no single portal to integrate with.
- Look into the city's open-data permit feed for status, and keep sending users to the city's PDF application process.

### State electrical permits (MN DLI)
- Many suburbs (Eden Prairie, for example) leave electrical permits to the Minnesota Department of Labor and Industry.
- A single DLI integration could cover electrical permits across the metro. Its lookup options haven't been researched yet.

## Submission and plan review

Researched November 3, 2026, for the three systems that cover the most
cities.

### How the three systems compare

| | LOGIS ePermits | Tyler Civic Access / EnerGov | BS&A Online |
|---|---|---|---|
| Public status lookup | Yes, no login | Yes, through the JSON API, no login | Yes, behind invisible reCAPTCHA v3 |
| Account to apply | Contractors must register; owners optional, with fewer features. Sign-up has a CAPTCHA and contractors pick their company from a city-run list. | Required. St. Paul emails a sign-in code at every login. One Tyler login works across cities. | Contractors register, and some cities issue a web PIN. Homeowners and contractors have separate application flows. |
| What can be filed online | Simple permits only | Broad, including building permits that need plans | Mostly simple residential. Lakeville says all permits. |
| Plan review | Separate system (ProjectDox) | Built in: St. Paul uses Bluebeam inside PAULIE; Woodbury takes uploads in the portal | Usually email or in person |
| Payment | Cart, card or bank transfer | Through the portal | Through the portal |
| Terms of use | None published. The [privacy statement](https://epermits.logis.org/privacy.aspx?city=ep) says application data is public under Minnesota law, except card details. | Not public; covered by each city's contract with Tyler | Bans bots, scraping and commercial use without written consent |
| robots.txt | `Disallow: /` for all agents | None | Allows crawling, blocks AI crawlers |

All three follow the same flow: an account is required to apply, status can
be searched publicly by permit number or address, and plans go through a
separate step.

### ProjectDox

[ProjectDox](https://www.avolvesoftware.com/) is electronic plan-review
software from Avolve Software, a private company that also makes DigEplan.
Applicants upload drawings, city reviewers mark them up, and applicants
upload revisions until the plans are approved. It has its own login,
separate from the permit portal.

| City | ProjectDox URL |
|---|---|
| Eden Prairie | `planreview.edenprairie.org/ProjectDox/` |
| Maple Grove | `planreview.maplegrovemn.gov/ProjectDox/` |
| Apple Valley | `applevalley-mn-us.avolvecloud.com` |
| St. Louis Park | Linked from the city's permits page |
| Minneapolis | Linked from the city's ProjectDox page |

In LOGIS cities the steps run in order. The applicant applies in ePermits,
and if the work needs plan review, the city emails an invitation to upload
plans in ProjectDox.

- **ePermits only:** trade and simple work, such as plumbing, HVAC, water
  heaters, roofing, siding and windows.
- **ePermits, then ProjectDox:** new homes, additions, larger remodels and
  commercial work.

No published split was found. Most permits by count likely never reach
ProjectDox, but the larger, higher-value jobs do. Counting St. Paul permits
by type through the EnerGov API could measure the split.

### What direct submission would require

On the current sites, submitting for a user means:

1. **Credentials:** storing each user's portal login, because CAPTCHAs and
   city-run contractor lists prevent creating accounts for them.
2. **A headless browser:** something like Cloudflare Browser Rendering or
   Playwright, logging in as the user and stepping through a multi-page
   application.
3. **Per-city mapping:** each city sets up its own permit types and
   questions, so fields must be mapped city by city.
4. **Payment:** entering the user's card in the city's checkout, which puts
   us in scope for PCI card-security requirements. The alternative is
   stopping at the cart and letting the user pay.
5. **Plans:** a second integration with ProjectDox where plans are needed.

Blockers:
- LOGIS's robots.txt disallows all automated access.
- BS&A's terms prohibit automation outright.
- St. Paul's sign-in code at every login prevents unattended logins.
- A wrong submission is a legal filing in the user's name.

Direct submission needs the operator's permission: LOGIS, Tyler or the city,
or BS&A. A company called [SignedOff](https://signedoff.io/adapters/energov)
is already building EnerGov integrations.

### Recommended model

1. **User submits, we track.** The user files on the city portal, then
   enters the permit number in the app. Permit-number lookup needs no
   account, and this works now for EnerGov and LOGIS.
2. **Make submitting easy without doing it for them.** Deep-link to the
   right city and permit type, and show the user's prepared answers to copy.
   A browser extension that fills in the city form inside the user's own
   session is a later option that needs no stored credentials and no card
   handling.
3. **Ask the operators.** LOGIS is a cooperative owned by its member cities
   and already treats this data as public, so it is the first to approach.
   Tyler and BS&A follow. If data access stalls, cities can be asked for
   permit data under Minnesota's public-records law (Minn. Stat. ch. 13).

## Proposed order

1. **Tyler EnerGov.** A working API that covers St. Paul and four suburbs.
2. **LOGIS ePermits.** One site covers 14 cities. Contact LOGIS before
   scaling, because its robots.txt disallows automated access.
3. **Minneapolis open data**, and then the smaller systems as demand grows.
4. **BS&A Online.** One site covers 8 cities, but only once BS&A gives
   written consent.

EnerGov and LOGIS together cover 20 of the 49 cities checked, or 28 once
BS&A agrees.

## Constraints

- **Read-only status lookups are feasible. Filing applications for users is not.** Nearly every portal requires a city account, often a contractor account with a state license on file. The app should prepare forms and send users to the city's own "apply" page.
- **Scraping obligations:** follow each portal's terms of use and robots.txt, cache results, rate-limit requests, and identify the app in the user agent. Status checks should be prompted by a user's permit, a few per permit per day, never a crawl.
- **Breakage:** vendor portals change layouts and APIs without notice. Each integration needs monitoring and should fall back to a deep link when it fails.
