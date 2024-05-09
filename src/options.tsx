import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./options.css";

interface IOptions {
  isUsingWholePageHTML: boolean;
  theme: "light" | "dark";
  systemPrompt: string;
  model: string;
}

const Options = () => {
  const [options, setOptions] = useState<IOptions>();
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const restoreOptions = () => {
    chrome.storage.sync.get("options", (data) => {
      if (data.options) setOptions(data.options);
      else {
        fetch("defaultoptions.json", { cache: "no-store" }).then((res) => {
          res.json().then((data) => {
            setOptions(data);
          });
        });
      }
    });
  };
  useEffect(() => {
    restoreOptions();
    fetch("http://localhost:11434/api/tags", { cache: "no-store" })
      .then((resp) => resp.json())
      .then((data) => {
        const names = data.models.map((model: any) => model.name);
        setAvailableModels(names);
      });
  }, []);

  const handleOptionChange = (option: keyof IOptions, value: any) => {
    console.log(`Option ${option} changed to ${value}`);
    setOptions(
      (prevOptions) =>
        ({
          ...prevOptions,
          [option]: value,
        }) as IOptions
    );
  };

  const saveOptions = () => {
    chrome.storage.sync.set({ options });
    alert("Options saved!");
    window.location.reload();
  };
  const clearOptions = () => {
    chrome.storage.sync.clear();
    alert("Options cleared!");
  };
  return options ? (
    <div className="settingsContainer">
      <h1 className="header">Options</h1>
      <label className="optionLabel">
        Use whole page HTML (Model can answer weird because of this option, but
        it will have more context.)
        <select
          onChange={(e) =>
            handleOptionChange(
              "isUsingWholePageHTML",
              e.target.value === "true"
            )
          }
          value={options.isUsingWholePageHTML ? "true" : "false"}
          className="select"
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </label>
      <label className="optionLabel">
        Theme
        <select
          onChange={(e) => handleOptionChange("theme", e.target.value)}
          value={options.theme}
          className="select"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label className="optionLabel">
        System prompt
        <textarea
          value={options.systemPrompt}
          onChange={(e) => handleOptionChange("systemPrompt", e.target.value)}
          className="textarea"
        ></textarea>
      </label>
      {availableModels.length > 0 ? (
        <label className="optionLabel">
          Model
          <select
            onChange={(e) => handleOptionChange("model", e.target.value)}
            value={options.model}
            className="select"
          >
            {availableModels.map((model, i) => (
              <option key={i} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="buttons">
        <button className="button" onClick={() => saveOptions()}>
          save
        </button>
        <button className="button" onClick={() => clearOptions()}>
          Debug: CLEAR OPTIONS
        </button>
      </div>
    </div>
  ) : (
    <div>Loading...</div>
  );
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);
