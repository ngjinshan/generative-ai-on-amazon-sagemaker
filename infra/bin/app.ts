#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ArDoorVisualizerStack } from "../lib/stack";

const app = new cdk.App();
new ArDoorVisualizerStack(app, "ArDoorVisualizerStack", {
  env: { region: "us-east-1" },
});
