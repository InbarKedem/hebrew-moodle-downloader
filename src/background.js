/**
 * moodleDownloader - a chrome extension for batch downloading Moodle resources 💾
 * Copyright (c) 2018 Harsil Patel
 * https://github.com/harsilspatel/MoodleDownloader
 */

function getDownloadOptions(sesskey, url) {
	if (!url.includes("folder")) {
		// Resources, URLs, Pages.
		// URLs and Pages need to be handled in popup.js.
		return {
			url: url + "&redirect=1",
		};
	}
	const urlObj = new URL(url);
	const id = urlObj.searchParams.get("id");
	// We will modify the downloadURL such that each folder has a
	// unique download URL (so suggestFilename will work).
	// Adding "?id=ID" to the POST URL still results in a valid
	// request, so we can use this to uniquely identify downloads.
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
				value: "application/x-www-form-urlencoded",
			},
		],
		body: `id=${id}&sesskey=${sesskey}`,
	};
}

// Supported file types in English and Hebrew
var SUPPORTED_FILES = new Set([
	"File", // English: File
	"Folder", // English: Folder
	"URL", // English: URL
	"Page", // English: Page
	"קובץ", // Hebrew: File
	"תיקייה", // Hebrew: Folder
	"כתובת אינטרנט", // Hebrew: URL
	"דף", // Hebrew: Page
]);

function getFilesUnderSection(sesskey) {
	// Support multiple Moodle format selectors (old, new, TAU)
	const selectorOptions = [
		document.querySelectorAll(".content"),
		document.querySelectorAll(".section"),
		document.querySelectorAll("[class*='course-content'] li[class*='section']"),
		document.querySelectorAll("li.section"),
		document.querySelectorAll("[class*='section'][class*='main']"),
	];

	let contents = [];
	for (let selector of selectorOptions) {
		if (selector.length > 0) {
			contents = Array.from(selector);
			console.log("Found", contents.length, "sections using selector");
			break;
		}
	}

	if (contents.length === 0) {
		console.warn(
			"No content sections found with any selector"
		);
		return [];
	}

	return contents
		.map((content) => {
			// Try multiple selectors for section name
			let sectionEl = content.querySelector("h3.sectionname");
			if (!sectionEl) sectionEl = content.querySelector("h3");
			if (!sectionEl)
				sectionEl = content.querySelector("[class*='section-title']");
			if (!sectionEl)
				sectionEl = content.querySelector(".sectionname");
			if (!sectionEl)
				sectionEl = content.querySelector("[class*='section'] > h3");

			if (!sectionEl) return [];

			const section = sectionEl.textContent.trim();

			// Get activities - try multiple selectors for different Moodle versions
			let activities = Array.from(content.querySelectorAll(".activity"));
			if (activities.length === 0) {
				activities = Array.from(
					content.querySelectorAll("[class*='activity']")
				);
			}
			if (activities.length === 0) {
				activities = Array.from(
					content.querySelectorAll("li[class*='activity']")
				);
			}
			if (activities.length === 0) {
				activities = Array.from(
					content.querySelectorAll("div.mod")
				);
			}

			console.log("Section:", section, "Activities:", activities.length);

			return activities
				.map((activity) => ({
					instanceName:
						activity.getElementsByClassName("instancename")[0] ||
						activity.querySelector(".activityname") ||
						activity.querySelector("[class*='instancename']"),
					archorTag: activity.getElementsByTagName("a")[0] ||
						activity.querySelector("a[href*='mod/']"),
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
					section: section,
				}))
				.filter((activity) => SUPPORTED_FILES.has(activity.type));
		})
		.reduce((x, y) => x.concat(y), []);
}

function getFilesUnderResources(sesskey, tableBody) {
	return Array.from(tableBody.children) // to get files under Resources tab
		.filter((resource) => resource.getElementsByTagName("img").length != 0)
		.map(
			(resource) =>
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
						.textContent.trim(),
				})
		)
		.map((resource, index, array) => {
			resource.section =
				resource.section ||
				(array[index - 1] && array[index - 1].section) ||
				"";
			return resource;
		})
		.filter((resource) => SUPPORTED_FILES.has(resource.type));
}

function getFilesFromModernLayout(sesskey) {
	// For modern Moodle 4.x layouts with different DOM structure
	const files = [];
	
	// Try to find all elements that contain activity links
	const allLinks = document.querySelectorAll("a[href*='/mod/']");
	
	allLinks.forEach((link) => {
		try {
			// Find parent activity container
			let activityContainer = link.closest(".activity") || 
									 link.closest("li[class*='activity']") ||
									 link.closest("div[class*='activity']") ||
									 link.closest(".mod") ||
									 link.closest("li.mod");
			
			if (!activityContainer) return;
			
			// Find the activity name/type
			let nameEl = activityContainer.querySelector(".instancename") ||
						 activityContainer.querySelector(".activityname") ||
						 activityContainer.querySelector("span.instancename") ||
						 link.querySelector("span");
			
			if (!nameEl) return;
			
			const name = nameEl.textContent.trim();
			
			// Try to extract type from instancename structure
			let type = "";
			const instanceNameEl = activityContainer.querySelector(".instancename");
			if (instanceNameEl) {
				// The type is usually in a span after the link or as lastChild
				const typeEl = instanceNameEl.querySelector("span") || instanceNameEl.lastChild;
				type = typeEl ? typeEl.textContent.trim() : "";
			}
			
			if (!type) {
				// Try to find type from title or aria-label
				type = link.getAttribute("title") || link.getAttribute("aria-label") || "";
			}
			
			// Extract section name
			let section = "";
			let sectionContainer = activityContainer.closest("[class*='section']");
			if (sectionContainer) {
				let sectionNameEl = sectionContainer.querySelector("h3") ||
									 sectionContainer.querySelector("h2") ||
									 sectionContainer.querySelector("[class*='sectionname']");
				section = sectionNameEl ? sectionNameEl.textContent.trim() : "";
			}
			
			if (name && SUPPORTED_FILES.has(type)) {
				files.push({
					name: name,
					downloadOptions: getDownloadOptions(sesskey, link.href),
					type: type,
					section: section,
				});
			}
		} catch (e) {
			console.log("Error processing activity:", e);
		}
	});
	
	return files;
}

function getFiles() {
	try {
		console.log("Starting getFiles()...");

		const h1s = document.getElementsByTagName("h1");
		const headerTitles = document.getElementsByClassName("header-title");
		const breadcrumbItems =
			document.getElementsByClassName("breadcrumb-item");
		const pageHeader = document.querySelector(
			"header#page-header .header-title"
		);
		const courseName = (
			(h1s.length && h1s[0].innerText) ||
			(headerTitles.length && headerTitles[0].innerText) ||
			pageHeader.textContent ||
			(breadcrumbItems.length > 2 &&
				breadcrumbItems[2].firstElementChild.title) ||
			""
		).trim();

		console.log("Course name:", courseName);

		// The session key should normally be accessible through window.M.cfg.sesskey,
		// but getting the window object is hard.
		// Instead, we can grab the session key from the logout button.
		// Note that var is used here as this script can be executed multiple times.
		let sesskey = null;
		try {
			const logoutBtn = document.querySelector(
				"a[href*='login/logout.php']"
			);
			if (logoutBtn) {
				sesskey = new URL(logoutBtn.href).searchParams.get("sesskey");
			} else {
				console.warn(
					"Logout button not found, sesskey may be unavailable"
				);
			}
		} catch (e) {
			console.warn("Error getting sesskey:", e);
			sesskey = null;
		}

		console.log("Session key:", sesskey);

		// Try to find resources in both old and new Moodle formats
		const tableBody = document.querySelector(
			"div[role='main'] > table.generaltable.mod_index > tbody"
		);
		console.log(
			"Table body found (old Resources tab):",
			tableBody !== null
		);

		let allFiles;
		if (tableBody !== null) {
			// Old format with Resources tab
			allFiles = getFilesUnderResources(sesskey, tableBody);
		} else {
			// New format with course sections
			allFiles = getFilesUnderSection(sesskey);
		}

		// If still no files found, try the modern layout fallback
		if (allFiles.length === 0) {
			console.log("No files found with standard selectors, trying modern layout approach...");
			allFiles = getFilesFromModernLayout(sesskey);
		}

		allFiles.forEach((file) => (file.course = courseName));
		console.log("Total files found:", allFiles.length);
		console.log("Files:", allFiles);

		return allFiles;
	} catch (error) {
		console.error("Error in getFiles():", error);
		return [];
	}
}

// Return the files for the extension to use
getFiles();
