/**
 * moodleDownloader - a chrome extension for batch downloading Moodle resources 💾
 * Copyright (c) 2018 Harsil Patel
 * https://github.com/harsilspatel/MoodleDownloader
 */
function main() {
    // google analytics
    (function(i, s, o, g, r, a, m) {
        i["GoogleAnalyticsObject"] = r;
        (i[r] =
            i[r] ||
            function() {
                (i[r].q = i[r].q || []).push(arguments);
            }),
            (i[r].l = 1 * new Date());
        (a = s.createElement(o)), (m = s.getElementsByTagName(o)[0]);
        a.async = 1;
        a.src = g;
        m.parentNode.insertBefore(a, m);
    })(
        window,
        document,
        "script",
        "https://www.google-analytics.com/analytics.js",
        "ga"
    );

    ga("create", "UA-119398707-1", "auto");
    ga("set", "checkProtocolTask", null);
    ga("send", "pageview");

    // downloadResources on button press
    const button = document.getElementById("downloadResources");
    button.addEventListener("click", () => {
        downloadResources();
    });

    document.getElementById("shareLink").addEventListener("click", () => {
        var copyFrom = document.createElement("textarea");
        copyFrom.textContent =
            "https://chrome.google.com/webstore/detail/geckodm/pgkfjobhhfckamidemkddfnnkknomobe";
        document.body.appendChild(copyFrom);
        copyFrom.select();
        document.execCommand("copy");
        copyFrom.blur();
        document.body.removeChild(copyFrom);
    });

    document.getElementById("sourceCode").addEventListener("click", () => {
        chrome.tabs.create({
            url: "https:github.com/harsilspatel/moodleDownloader"
        });
    });

    // filter resources on input
    const searchField = document.getElementById("search");
    searchField.addEventListener("input", () => {
        filterOptions();
    });

    // executing background.js to populate the select form
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript(
            {
                target: { tabId: tabs[0].id },
                function: getFiles
            },
            (results) => {
                try {
                    const resourceSelector = document.getElementById(
                        "resourceSelector"
                    );
                    const resources = results[0].result;
                    resourcesList = [...resources];
                    console.log(results);
                    resources.forEach((resource, index) => {
                        const resourceOption = document.createElement("option");

                        // creating option element such that the text will be
                        // the resource name and the option value its index in the array.
                        resourceOption.value = index.toString();
                        resourceOption.title = resource.name;
                        resourceOption.innerHTML = resource.name;
                        resourceSelector.appendChild(resourceOption);
                    });
                } catch (error) {
                    console.log(error);
                }
            }
        );
    });
    initStorage();
}

function initStorage() {
    chrome.storage.sync.get(["downloads", "alreadyRequested"], result => {
        const downloads = result.downloads ? result.downloads : 0;
        const alreadyRequested = result.alreadyRequested
            ? result.alreadyRequested
            : false;
        chrome.storage.sync.set(
            { downloads: downloads, alreadyRequested: alreadyRequested },
            function() {
                console.log("initialised storage variables");
            }
        );
    });
}

function requestFeedback() {
    chrome.storage.sync.get(["downloads", "alreadyRequested"], result => {
        console.log("inside requestFeedback");
        if (result.downloads >= 50 && result.alreadyRequested == false) {
            console.log("attaching ");
            const nah = document.getElementById("nah");
            const sure = document.getElementById("sure");
            const feedbackDiv = document.getElementById("feedbackDiv");
            const feedbackPrompt = document.getElementById("feedbackPrompt");
            feedbackDiv.removeAttribute("hidden");

            nah.addEventListener("click", () => {
                chrome.storage.sync.set({ alreadyRequested: true }, function() {
                    console.log("alreadyRequested is set to " + true);
                });
                nah.setAttribute("hidden", "hidden");
                sure.setAttribute("hidden", "hidden");
                feedbackPrompt.innerHTML = "";
                setTimeout(() => {
                    feedbackDiv.setAttribute("hidden", "hidden");
                }, 2000);
            });

            sure.addEventListener("click", () => {
                chrome.storage.sync.set({ alreadyRequested: true }, function() {
                    console.log("alreadyRequested is set to " + true);
                });
                nah.setAttribute("hidden", "hidden");
                sure.setAttribute("hidden", "hidden");
                feedbackPrompt.innerHTML = "You're a very considerate human! 💝";
                setTimeout(() => {
                    feedbackDiv.setAttribute("hidden", "hidden");
                    chrome.tabs.create({
                        url:
                            "https://chrome.google.com/webstore/detail/moodle-downloader/ohhocacnnfaiphiahofcnfakdcfldbnh"
                    });
                }, 2000);
            });
        }
    });
}

function filterOptions() {
    const searchField = document.getElementById("search");
    const query = searchField.value.toLowerCase();
    const regex = new RegExp(query, "i");
    const options = document.getElementById("resourceSelector").options;

    resourcesList.forEach((resource, index) => {
        resource.name.match(regex)
            ? options[index].removeAttribute("hidden")
            : options[index].setAttribute("hidden", "hidden");
    });
}

function updateDownloads(newDownloads) {
    chrome.storage.sync.get(["downloads"], result => {
        const value = result.downloads ? result.downloads : 0;
        console.log("Value currently is " + value);
        const newValue = value + newDownloads;
        console.log(typeof value);
        chrome.storage.sync.set({ downloads: newValue }, function() {
            console.log("Value is set to " + newValue);
        });
    });
}

let organizeChecked = false;
let replaceFilename = false;

function sanitiseFilename(filename) {
    return filename.replace(/[\\/:*?"<>|]/g, "-");
}

function suggestFilename(downloadItem, suggest) {
    const item = resourcesList.filter(
        r => r.downloadOptions.url == downloadItem.url
    )[0];
    let filename = downloadItem.filename;
    const sanitisedItemName = sanitiseFilename(item.name);

    if (item.type === "URL") {
        // The filename should be some arbitrary Blob UUID.
        // We should always replace it with the item's name.
        filename = sanitisedItemName + ".url";
    } else if (item.type === "Page") {
        filename = sanitisedItemName + ".html";
    }

    if (replaceFilename) {
        const lastDot = filename.lastIndexOf(".");
        const extension = lastDot === -1 ? "" : filename.slice(lastDot);
        filename = sanitisedItemName + extension;
    }

    if (organizeChecked) {
        suggest({
            filename:
                sanitiseFilename(item.course) +
                "/" +
                (item.section && sanitiseFilename(item.section) + "/") +
                filename
        });
    } else {
        suggest({ filename });
    }
}

function downloadResources() {
    const INTERVAL = 500;
    const footer = document.getElementById("footer");
    const button = document.getElementById("downloadResources");
    const resourceSelector = document.getElementById("resourceSelector");
    const selectedOptions = Array.from(resourceSelector.selectedOptions);
    organizeChecked = document.getElementById("organize").checked;
    replaceFilename = document.getElementById("replaceFilename").checked;
    const hasDownloadsListener = chrome.downloads.onDeterminingFilename.hasListener(
        suggestFilename
    );

    // add listener to organize files
    if (!hasDownloadsListener)
        chrome.downloads.onDeterminingFilename.addListener(suggestFilename);

    // hidding the button and showing warning text
    button.setAttribute("hidden", "hidden");
    const warning = document.createElement("small");
    warning.style.color = "red";
    warning.innerHTML =
        "Please keep this window open until selected resources are not downloaded...";
    footer.appendChild(warning);

    // updating stats
    updateDownloads(selectedOptions.length);

    // showing the button and removing the text and requesting for feedback
    setTimeout(() => {
        footer.removeChild(warning);
        button.removeAttribute("hidden");
        requestFeedback();
    }, (selectedOptions.length + 4) * INTERVAL);

    selectedOptions.forEach((option, index) => {
        const resourceIndex = Number(option.value);
        const resource = resourcesList[resourceIndex];
        if (resource.type === "URL") {
            // We need to get the URL of the redirect and create a blob for it.
            fetch(resource.downloadOptions.url, { method: "HEAD" }).then(
                req => {
                    const blob = new Blob(
                        [`[InternetShortcut]\nURL=${req.url}\n`],
                        { type: "text/plain" }
                    );
                    const blobUrl = URL.createObjectURL(blob);
                    const newOptions = {
                        url: blobUrl
                    };
                    resource.downloadOptions = newOptions;
                    setTimeout(() => {
                        chrome.downloads.download(newOptions);
                    }, index * INTERVAL);
                }
            );
        } else if (resource.type === "Page") {
            fetch(resource.downloadOptions.url)
                .then(req => {
                    return req.text();
                })
                .then(text => {
                    // We want to grab "[role='main']" from the text and save that
                    // as an HTML file.
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(text, "text/html");
                    const toSave = doc.querySelector("[role='main']").outerHTML;
                    const blob = new Blob([toSave], { type: "text/html" });
                    const blobUrl = URL.createObjectURL(blob);
                    const newOptions = {
                        url: blobUrl
                    };
                    resource.downloadOptions = newOptions;
                    setTimeout(() => {
                        chrome.downloads.download(newOptions);
                    }, index * INTERVAL);
                });
        } else {
            setTimeout(() => {
                chrome.downloads.download(resource.downloadOptions);
            }, index * INTERVAL);
        }
    });

    ga("send", "event", {
        eventCategory: "click",
        eventAction: "downloadResources",
        eventValue: selectedOptions.length
    });
}

function getDownloadOptions(sesskey, url) {
	if (!url.includes("folder")) {
		return {
			url: url + "&redirect=1"
		};
	}
	const urlObj = new URL(url);
	const id = urlObj.searchParams.get("id");
	const downloadUrl =
		urlObj.origin +
		urlObj.pathname.slice(undefined, urlObj.pathname.lastIndexOf("/")) +
		"/download_folder.php?id=" +
		id;
	return {
		url: downloadUrl,
		method: "POST",
		headers: [
			{
				name: "content-type",
				value: "application/x-www-form-urlencoded"
			}
		],
		body: `id=${id}&sesskey=${sesskey}`
	};
}

var SUPPORTED_FILES = new Set([
	"File", "Folder", "URL", "Page",
	"קובץ", "תיקייה", "כתובת אינטרנט", "דף"
]);

function getFilesUnderSection(sesskey) {
	return Array.from(document.getElementsByClassName("content"))
		.map(content => {
			const sectionEl = content.querySelector("h3.sectionname");
			if (!sectionEl) return [];
			const section = sectionEl.textContent.trim();
			return Array.from(content.getElementsByClassName("activity"))
				.map(activity => ({
					instanceName: activity.getElementsByClassName(
						"instancename"
					)[0],
					archorTag: activity.getElementsByTagName("a")[0]
				}))
				.filter(
					({ instanceName, archorTag }) =>
						instanceName !== undefined && archorTag !== undefined
				)
				.map(({ instanceName, archorTag }) => ({
					name: instanceName.firstChild.textContent.trim(),
					downloadOptions: getDownloadOptions(
						sesskey,
						archorTag.href
					),
					type: instanceName.lastChild.textContent.trim(),
					section: section
				}))
				.filter(activity => SUPPORTED_FILES.has(activity.type));
		})
		.reduce((x, y) => x.concat(y), []);
}

function getFilesUnderResources(sesskey, tableBody) {
	return Array.from(tableBody.children)
		.filter(resource => resource.getElementsByTagName("img").length != 0)
		.map(
			resource =>
				(resource = {
					name: resource
						.getElementsByTagName("a")[0]
						.textContent.trim(),
					downloadOptions: getDownloadOptions(
						sesskey,
						resource.getElementsByTagName("a")[0].href
					),
					type: resource.getElementsByTagName("img")[0]["alt"].trim(),
					section: resource
						.getElementsByTagName("td")[0]
						.textContent.trim()
				})
		)
		.map((resource, index, array) => {
			resource.section =
				resource.section ||
				(array[index - 1] && array[index - 1].section) ||
				"";
			return resource;
		})
		.filter(resource => SUPPORTED_FILES.has(resource.type));
}

function getFiles() {
	const h1s = document.getElementsByTagName("h1");
	const headerTitles = document.getElementsByClassName("header-title");
	const breadcrumbItems = document.getElementsByClassName("breadcrumb-item");
	const pageHeader = document.querySelector("header#page-header .header-title")
	const courseName = (
			h1s.length && h1s[0].innerText ||
			headerTitles.length && headerTitles[0].innerText ||
			pageHeader.textContent ||
			breadcrumbItems.length > 2 && breadcrumbItems[2].firstElementChild.title ||
			""
		).trim();

	const sesskey = new URL(
		document.querySelector("a[href*='login/logout.php']").href
	).searchParams.get("sesskey");

	const tableBody = document.querySelector(
		"div[role='main'] > table.generaltable.mod_index > tbody"
	);
	const allFiles =
		tableBody === null
			? getFilesUnderSection(sesskey)
			: getFilesUnderResources(sesskey, tableBody);
	allFiles.forEach(file => (file.course = courseName));
	return allFiles;
}

document.addEventListener("DOMContentLoaded", () => {
    main();
    var resourcesList = [];
});
