const express = require('express');
const app = express();
const path = require('path');
const fs = require("fs")
const emptyTemplate = require('./empty-templates/empty-template.json');
const emptyPageTemplate = require('./empty-templates/empty-page-template.json');

const _runServer = (config = {
	designerPort: 8686,
	templatePath: __dirname,
	licenseKey: '' }) => {
	const { designerPort, templatePath, licenseKey } = config
	if(licenseKey) GC.ActiveReports.Core.setLicenseKey(licenseKey)
	app.set('views', path.join(__dirname));
	app.set('view engine', 'pug');
	app.use(express.json({ limit: '1mb' }));
	const rootPath = path.join(templatePath, 'templates');
	let reportNames = []

	if (!fs.existsSync(rootPath)) {
		fs.mkdir(rootPath, async (err) => {
			if (err) throw err;
			fs.mkdir(path.join(templatePath, 'templates', 'report'), (err) => {
				const jsonContentData = JSON.stringify(emptyTemplate);
				fs.writeFile(path.join(rootPath, `report/template.json`), jsonContentData, (err) => {
					if (err) throw err;
				})
			})
		});
	}

	app.use("/scripts", express.static(path.join(__dirname, "../", "@grapecity" , "activereports" ,"dist")));
	app.use("/styles", express.static(path.join(__dirname, "../", "@grapecity" , "activereports" ,"styles")));
	app.use("/templates", express.static(path.join(templatePath, "templates")));

	function getDirectoriesRecursively(dirPath, parentPath = '') {
		const directories = [];
		const files = fs.readdirSync(dirPath, { withFileTypes: true });

		files.forEach(file => {
			const fullPath = path.join(dirPath, file.name);
			const relativePath = path.join(parentPath, file.name);

			if (file.isDirectory()) {
				const subDirectories = getDirectoriesRecursively(fullPath, relativePath);
				if (subDirectories.length > 0) {
					directories.push({ directory: relativePath, subDirectories });
				} else {
					directories.push({ directory: relativePath });
				}
			}
		});
		return directories;
	}

	reportNames = getDirectoriesRecursively(rootPath);
	app.get('/', function(req, res) {
		res.render('designer', { title: 'Report Designer', reportName: reportNames[0].directory, reportNames });
	});
	app.post('/templates', (req, res) => {
		const withContent = !!req.body?.withContent
		const data = req.body?.definition || (withContent ? emptyPageTemplate : emptyTemplate);
		const reportPath = req.body.id
		let newReportPatch = null
		if(!req.body.id) {
			const newReportName = req.body?.reportName || Date.now()
			newReportPatch = `templates/${newReportName}`
			if(withContent) {
				const reportName = newReportPatch.split('/')
				data.FixedPage.Pages[0].ReportItems[0].ReportName = `${reportName[1]}/content`
			}
			fs.mkdir(path.join(templatePath, newReportPatch), (err) => {
				if (err) throw err;
				const newReportPatchPage = `${newReportPatch}/template.json`
				fs.writeFile(path.join(templatePath, newReportPatchPage), JSON.stringify(data, null, 2), (err) => {
					if (err) throw err;
				})
				if(withContent) {
					const newReportPatchContent = `${newReportPatch}/content`
					reportNames.push({ directory:  newReportName, subDirectories: [{ directory:  `${newReportName}/content` }] })
					fs.mkdir(path.join(templatePath, newReportPatchContent), (err) => {
						if (err) throw err;
						const jsonContentData = JSON.stringify(emptyTemplate, null, 2);
						fs.writeFile(path.join(templatePath, `${newReportPatch}/content/template.json`), jsonContentData, (err) => {
							if (err) throw err;
						})
					})
				} else reportNames.push({ directory:  newReportName })
			});
			res.send({ path: newReportPatch, withContent });
			return
		}
		fs.writeFile(path.join(templatePath, reportPath), JSON.stringify(data, null, 2), (err) => {
			if (err) throw err;
		})
		res.send('');
	});

	app.listen(designerPort)
}

module.exports = {
	_runServer
}
