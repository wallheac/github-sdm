import { HandlerContext } from "@atomist/automation-client";
import { clean, ProjectReview } from "@atomist/automation-client/operations/review/ReviewResult";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";

export async function logReview(p: GitProject,
                                ctx: HandlerContext): Promise<ProjectReview> {
    // try {
    //     await p.findFile("pom.xml");
    //     return {passed: true};
    // } catch {
    //     return {passed: false, message: "This project has no pom. Cannot deploy"};
    // }
    console.log("REVIEWING THING");
    return clean(p.id);
}

export async function logInspect(p: GitProject,
                                 ctx: HandlerContext): Promise<ProjectReview> {
    // try {
    //     await p.findFile("pom.xml");
    //     return {passed: true};
    // } catch {
    //     return {passed: false, message: "This project has no pom. Cannot deploy"};
    // }
    console.log("INSPECTING THING");
    return clean(p.id);
}