import { logger } from "@atomist/automation-client";
import { ProjectOperationCredentials } from "@atomist/automation-client/operations/common/ProjectOperationCredentials";
import { GitCommandGitProject } from "@atomist/automation-client/project/git/GitCommandGitProject";
import * as yaml from "js-yaml";

import * as _ from "lodash";

import {RemoteRepoRef} from "@atomist/automation-client/operations/common/RepoId";
import {GitProject} from "@atomist/automation-client/project/git/GitProject";
import {Project} from "@atomist/automation-client/project/Project";
import archiver = require("archiver");
import * as fs from "fs";
import {DeployableArtifact} from "../../../../spi/artifact/ArtifactStore";
import {ArtifactDeployer} from "../../../../spi/deploy/ArtifactDeployer";
import {ProgressLog} from "../../../../spi/log/ProgressLog";
import {CloudFoundryApi, initializeCloudFoundry} from "./CloudFoundryApi";
import {Manifest} from "./CloudFoundryManifest";
import {CloudFoundryPusher} from "./CloudFoundryPusher";
import {CloudFoundryDeployment, CloudFoundryInfo, CloudFoundryManifestPath} from "./CloudFoundryTarget";

/**
 * Use the Cloud Foundry API to approximate their CLI to push.
 * Note that this is indeed thread safe concerning multiple logins and spaces.
 */
export class CloudFoundryPushDeployer implements ArtifactDeployer<CloudFoundryInfo, CloudFoundryDeployment> {

    protected getProject(creds: ProjectOperationCredentials, repoRef: RemoteRepoRef): Promise<GitProject> {
        return GitCommandGitProject.cloned(creds, repoRef);
    }

    private async getManifest(p: Project): Promise<Manifest> {
        const manifestFile = await p.findFile(CloudFoundryManifestPath);
        const manifestContent = await manifestFile.getContent();
        return yaml.load(manifestContent);
    }

    protected async archiveProject(baseDir: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const packageFilePath = baseDir + "/cfpackage.zip";
            const output = fs.createWriteStream(packageFilePath);
            output.on("close", () => {
                logger.info(`Created project archive ${packageFilePath}`);
                const packageFile = fs.createReadStream(packageFilePath);
                resolve(packageFile);
            });
            const archive = archiver("zip", {
                store: true,
            });
            archive.pipe(output);
            archive.directory(baseDir, false);
            archive.on("error",err => {
                reject(err);
            });
            archive.finalize();
        });
    }

    public async deploy(da: DeployableArtifact,
                        cfi: CloudFoundryInfo,
                        log: ProgressLog,
                        creds: ProjectOperationCredentials,
                        team: string): Promise<CloudFoundryDeployment[]> {
        logger.info("Deploying app [%j] to Cloud Foundry [%j]", da, cfi.description);
        if (!cfi.api || !cfi.org || !cfi.username || !cfi.password || !cfi.space) {
            throw new Error("cloud foundry authentication information missing. See CloudFoundryTarget.ts");
        }
        const sources = await this.getProject(creds, da.id);
        const packageFile = await this.archiveProject(sources.baseDir);
        const manifest = await this.getManifest(sources);
        const cfClient = await initializeCloudFoundry(cfi);
        const cfApi = new CloudFoundryApi(cfClient);
        const pusher = new CloudFoundryPusher(cfApi);
        const deploymentPromises = manifest.applications.map(manifest_app => {
            return pusher.push(cfi.space, manifest_app, packageFile, log);
        });
        return Promise.all(deploymentPromises);
    }

    public async findDeployments(da: DeployableArtifact,
                                 cfi: CloudFoundryInfo,
                                 creds: ProjectOperationCredentials): Promise<CloudFoundryDeployment[]> {
        if (!cfi.api || !cfi.org || !cfi.username || !cfi.password || !cfi.space) {
            throw new Error("cloud foundry authentication information missing. See CloudFoundryTarget.ts");
        }
        const sources = await this.getProject(creds, da.id);
        const manifest = await this.getManifest(sources);
        const cfClient = await initializeCloudFoundry(cfi);
        const cfApi = new CloudFoundryApi(cfClient);
        const pusher = new CloudFoundryPusher(cfApi);
        const space = await cfApi.getSpaceByName(cfi.space);
        const space_guid = space.metadata.guid;
        const apps = manifest.applications.map(async manifest_app => {
            const app = await cfApi.getApp(space_guid, manifest_app.name);
            if (app) {
                return manifest_app.name;
            } else {
                return undefined;
            }
        });
        const appNames = _.compact(await Promise.all(apps));
        return appNames.map(appName => {
            return {
                appName,
                endpoint: pusher.constructEndpoint(appName),
            } as CloudFoundryDeployment;
        });
    }

    public async undeploy(cfi: CloudFoundryInfo,
                          deployment: CloudFoundryDeployment,
                          log: ProgressLog): Promise<any> {
        logger.info(`Undeploying app ${cfi.space}:${deployment.appName} from Cloud Foundry ${cfi.description}`);
        if (!cfi.api || !cfi.org || !cfi.username || !cfi.password || !cfi.space) {
            throw new Error("cloud foundry authentication information missing. See CloudFoundryTarget.ts");
        }
        const cfClient = await initializeCloudFoundry(cfi);
        const cfApi = new CloudFoundryApi(cfClient);
        const space = await cfApi.getSpaceByName(cfi.space);
        const space_guid = space.metadata.guid;
        const app = await cfApi.getApp(space_guid, deployment.appName);
        if (app) {
            return cfApi.deleteApp(app.metadata.guid);
        }
    }

}
