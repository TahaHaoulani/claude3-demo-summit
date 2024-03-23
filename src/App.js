import React, { useState } from "react";
import {
  Autosuggest,
  ContentLayout,
  AppLayout,
  Button,
  BreadcrumbGroup,
  SideNavigation,
  FormField,
  Textarea,
  Container,
  Header,
  FileUpload,
  Flashbar,
  Badge,
  SpaceBetween,
} from "@cloudscape-design/components";
import AWS from "aws-sdk";
import { Buffer } from "buffer";
import { v4 as uuidv4 } from "uuid";

const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");

// Configure the AWS credentials and region
AWS.config.update({
  accessKeyId: process.env.REACT_APP_CLIENT_ID,
  secretAccessKey: process.env.REACT_APP_CLIENT_SECRET,
  region: "us-west-2",
});

// Create a Bedrock Runtime client
const bedrock = new BedrockRuntimeClient({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.REACT_APP_CLIENT_ID,
    secretAccessKey: process.env.REACT_APP_CLIENT_SECRET,
  },
});

// Create a CloudFormation service object
const cloudformation = new AWS.CloudFormation();

function getBase64(file) {
  return new Promise((resolve, reject) => {
    var reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

const App = () => {
  const [cfnCode, setCfnCode] = useState("");
  const [imageValue, setImageValue] = React.useState([]);
  const [setProgressItems] = React.useState([]);
  const [successItems, setSuccessItems] = React.useState([
    {
      type: "success",
      content: "Cloudformation template generated successfully.",
      action: <Button>Deploy template</Button>,
      dismissible: true,
      dismissLabel: "Dismiss message",
      onDismiss: () => setSuccessItems([]),
      id: "message_1",
    },
  ]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [showGenerateButton, setShowGenerateButton] = useState(false);
  const [showCfnCode, setShowCfnCode] = useState(false);
  const [showSuccessDeploy, setShowSuccessDeploy] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [showProgressDeploy, setShowProgressDeploy] = useState(false);
  const [modelValue, setModelValue] = React.useState("");
  const [descriptionValue, setDescriptionValue] = React.useState("");
  const [preferences, setPreferences] = React.useState(undefined);
  const [loading, setLoading] = React.useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [isValid, setIsValid] = useState(null);

  const convertImageToCFN = async () => {
    // Here, you would use Amazon Bedrock SDK and Cloud model
    // This is a placeholder function
    setShowProgress(true);
    if (imageValue.length === 0) {
      console.log("No file selected");
      return;
    }

    // Assuming the first file is the one we want to convert
    const base64String = await getBase64(imageValue[0]).catch((e) =>
      console.log(e)
    );

    if (!base64String) {
      console.log("Failed to convert file to Base64");
      return;
    }

    // Extract only the Base64 data part
    const base64Data = base64String.split(",")[1];

    //////////////////// Generate archi diagram description ////////////////////////////
    const promptDescription = `Give a detailled description of the architecture diagram in the image in French`;

    const requestDescription = {
      max_tokens: 1024,
      anthropic_version: "bedrock-2023-05-31",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: base64Data,
              },
            },
            { type: "text", text: promptDescription },
          ],
        },
      ],
    };

    // Make the invoke request
    const commandDescription = new InvokeModelCommand({
      modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
      body: JSON.stringify(requestDescription),
      contentType: "application/json",
      accept: "application/json",
    });
    const responseDescription = await bedrock.send(commandDescription);

    // Extract the response
    const completionDescription = JSON.parse(
      Buffer.from(responseDescription.body).toString("utf-8")
    );
    console.log(completionDescription.content[0].text);

    setDescriptionValue(completionDescription.content[0].text);
    setShowDescription(true);

    /////////////////////// Generate Cfn template ///////////////////////////////////
    const promptCfn = `From given architecture diagram in the image generate a valid cfn template to deploy on aws. Just give me th cfn template without complementary explanations`;

    const request = {
      max_tokens: 1024,
      anthropic_version: "bedrock-2023-05-31",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: base64Data,
              },
            },
            { type: "text", text: promptCfn },
          ],
        },
      ],
    };

    // Make the invoke request
    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
      body: JSON.stringify(request),
      contentType: "application/json",
      accept: "application/json",
    });
    const response = await bedrock.send(command);

    // Extract the response
    const completion = JSON.parse(Buffer.from(response.body).toString("utf-8"));
    console.log(completion.content[0].text);

    setCfnCode(completion.content[0].text);
    setShowCfnCode(true);

    setShowProgress(false);
    setShowSuccess(true);
  };

  const deployCFN = async () => {
    setShowProgressDeploy(true);
    // Get the current timestamp
    const timestamp = Date.now();
    const uuid = uuidv4();
    const stackName = `aws-summit-paris-${timestamp}-claude3-${uuid}`;
    const params = {
      StackName: stackName,
      TemplateBody: cfnCode,
      Parameters: [{}],
      Capabilities: ["CAPABILITY_IAM", "CAPABILITY_NAMED_IAM"],
    };

    try {
      const data = await cloudformation.createStack(params).promise();
      console.log("Stack creation initiated:", data);
      setShowProgressDeploy(false);
      setShowSuccessDeploy(true);
      // You can use the StackId from data for further operations, like monitoring stack creation progress.
    } catch (error) {
      console.error("Error deploying CFN template:", error);
    }
  };

  return (
    <AppLayout
      breadcrumbs={
        <BreadcrumbGroup
          items={[
            { text: "Home", href: "#" },
            { text: "AWS architecture diagram to code", href: "#" },
          ]}
        />
      }
      navigationOpen={true}
      navigation={
        <SideNavigation
          header={{
            href: "#",
            text: "AWS Paris Summit 2024",
          }}
          items={[
            {
              type: "link",
              text: `AWS architecture diagram to code`,
              href: `#`,
            },
          ]}
        />
      }
      content={
        <ContentLayout
          header={
            <Header variant="h1">
              Generate CloudFormation template from AWS architecture diagram
              <SpaceBetween direction="horizontal" size="xs">
                <Badge color="green">Demo</Badge>
                <Badge color="blue">Paris Summit</Badge>
                <Badge color="grey">2024</Badge>
              </SpaceBetween>
            </Header>
          }
        >
          {showProgress && (
            <Flashbar
              items={[
                {
                  type: "success",
                  loading: true,
                  content: "Cloudformation template is being generated...",
                  dismissible: true,
                  dismissLabel: "Dismiss message",
                  onDismiss: () => setShowProgress(false),
                  id: "progress_message",
                },
              ]}
            />
          )}
          {showProgressDeploy && (
            <Flashbar
              items={[
                {
                  type: "success",
                  loading: true,
                  content: "Cloudformation template is being deployed...",
                  dismissible: true,
                  dismissLabel: "Dismiss message",
                  onDismiss: () => setShowProgressDeploy(false),
                  id: "progress_message",
                },
              ]}
            />
          )}

          {showSuccess && (
            <Flashbar
              items={[
                {
                  type: "success",
                  content: "CloudFormation template successfully generated!",
                  dismissible: true,
                  dismissLabel: "Dismiss message",
                  onDismiss: () => setShowSuccess(false),
                  id: "success_message",
                },
              ]}
            />
          )}
          {showSuccessDeploy && (
            <Flashbar
              items={[
                {
                  type: "success",
                  content: "CloudFormation template successfully deployed!",
                  dismissible: true,
                  dismissLabel: "Dismiss message",
                  onDismiss: () => setShowSuccessDeploy(false),
                  id: "success_message",
                },
              ]}
            />
          )}
          <Container
            header={
              <Header
                variant="h2"
                description="Ready to chat using the bedrock-claude-3 model."
              >
                <Autosuggest
                  onChange={({ detail }) => setModelValue(detail.value)}
                  value={modelValue}
                  options={[
                    { value: "Claude v3 (Sonnet)" },
                    { value: "Claude v3 (Haiku)" },
                    { value: "Claude v3 (Opus)" },
                  ]}
                  ariaLabel="Autosuggest example with suggestions"
                  placeholder="Choose model"
                  empty="No matches found"
                />
              </Header>
            }
          >
            <div className="contentPlaceholder">
              <FormField label="Upload AWS architecture diagram">
                <FileUpload
                  onChange={({ detail }) => {
                    setImageValue(detail.value);
                    setShowGenerateButton(true);
                    const newUrl = URL.createObjectURL(detail.value[0]);
                    setImageUrl(newUrl);
                  }}
                  value={imageValue}
                  i18nStrings={{
                    uploadButtonText: (e) =>
                      e ? "Choose files" : "Choose file",
                    dropzoneText: (e) =>
                      e ? "Drop files to upload" : "Drop file to upload",
                    removeFileAriaLabel: (e) => `Remove file ${e + 1}`,
                    limitShowFewer: "Show fewer files",
                    limitShowMore: "Show more files",
                    errorIconAriaLabel: "Error",
                  }}
                  showFileLastModified
                  showFileSize
                  showFileThumbnail
                  tokenLimit={3}
                  constraintText="File size should not exceed 1 MB"
                />
              </FormField>
              {showGenerateButton && (
                <Button onClick={convertImageToCFN}>Generate template</Button>
              )}

              {imageUrl && (
                <div>
                  {/* Display the image using the src attribute */}
                  <img
                    src={imageUrl}
                    alt="User's Drawing"
                    style={{ maxWidth: "100%", height: "auto" }}
                  />
                </div>
              )}

              {showDescription && (
                <Textarea
                  onChange={({ detail }) => setDescriptionValue(detail.value)}
                  value={descriptionValue}
                  disabled
                  rows="10"
                  cols="50"
                />
              )}

              {showCfnCode && (
                <Textarea
                  onChange={(e) => {
                    setCfnCode(e.detail.value);
                  }}
                  value={cfnCode}
                  placeholder="Cloudformation template will appear here..."
                  rows="10"
                  cols="50"
                />
              )}
              {showCfnCode && <Button onClick={deployCFN}>Deploy stack</Button>}
            </div>
          </Container>
        </ContentLayout>
      }
    />
  );
};

export default App;
