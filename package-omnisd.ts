import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';

async function packageOmniSD() {
    const distDir = path.resolve(process.cwd(), 'dist');
    const outputDir = path.resolve(process.cwd(), 'packages');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    console.log('Creating application.zip...');
    const appZip = new AdmZip();
    appZip.addLocalFolder(distDir);
    const appZipPath = path.join(outputDir, 'application.zip');
    appZip.writeZip(appZipPath);

    console.log('Creating OmniSD package...');
    const omniZip = new AdmZip();
    omniZip.addLocalFile(appZipPath);
    
    // Add metadata and manifest to the root of the OmniSD package
    // These should also be in dist/ if they were in public/
    const metadataPath = path.join(distDir, 'metadata.json');
    const manifestPath = path.join(distDir, 'manifest.webapp');

    if (fs.existsSync(metadataPath)) {
        omniZip.addLocalFile(metadataPath);
    }
    if (fs.existsSync(manifestPath)) {
        omniZip.addLocalFile(manifestPath);
    }

    const packagePath = path.join(outputDir, 'kaios-ludo-omnisd.zip');
    omniZip.writeZip(packagePath);

    console.log(`Package created at: ${packagePath}`);
}

packageOmniSD().catch(err => {
    console.error('Packaging failed:', err);
    process.exit(1);
});
