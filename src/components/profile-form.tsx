"use client";
import { useId, useState } from "react";
import { useKnowledge } from "@/lib/store";
import { useProfiles } from "@/lib/profile-store";
import {
  defaultProfile,
  profileSchema,
  type JobsProfile,
} from "@/lib/profiles";
import { PROFILE_FIELDS, type ProfileField } from "@/lib/profile-fields";

function Tags({
  label,
  value,
  suggestions = [],
  onChange,
}: {
  label: string;
  value: string[];
  suggestions?: string[];
  onChange: (value: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const id = useId();
  const add = (text: string) => {
    const added = text
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    onChange([...new Set([...value, ...added])]);
    setInput("");
  };
  return (
    <div className="tag-field">
      <label htmlFor={id}>{label}</label>
      <div className="detail-chips">
        {value.map((tag) => (
          <button
            type="button"
            key={tag}
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(value.filter((v) => v !== tag))}
          >
            {tag} ×
          </button>
        ))}
      </div>
      <div className="tag-entry">
        <input
          id={id}
          value={input}
          placeholder="Type and press Enter"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              add(input);
            }
          }}
        />
        <button
          className="secondary-button"
          type="button"
          onClick={() => add(input)}
          aria-label={`Add ${label.toLowerCase()}`}
        >
          Add
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="suggestion-chips">
          {suggestions
            .filter((v) => !value.includes(v))
            .map((tag) => (
              <button type="button" key={tag} onClick={() => add(tag)}>
                {tag}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
export function ModeProfileForm() {
  const s = useKnowledge(),
    profiles = useProfiles();
  const [draft, setDraft] = useState<Record<string, unknown>>(() => ({
    ...(profiles.profiles[s.mode] ?? defaultProfile(s.mode)),
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [save, setSave] = useState(false),
    [resumeSkills, setResumeSkills] = useState<string[]>([]);
  const fields = PROFILE_FIELDS[s.mode];
  const validate = (value: Record<string, unknown>) => {
    const parsed = profileSchema.safeParse(value);
    setErrors(
      parsed.success
        ? {}
        : Object.fromEntries(
            parsed.error.issues.map((issue) => [
              String(issue.path[0] ?? "form"),
              issue.message,
            ]),
          ),
    );
    return parsed;
  };
  const update = (key: string, value: unknown) => {
    const next = { ...draft, [key]: value };
    setDraft(next);
    validate(next);
  };
  const render = (field: ProfileField) => {
    const id = `details-${s.mode}-${field.key}`,
      value = draft[field.key];
    if (field.kind === "skills") {
      const skills = value as JobsProfile["skills"];
      return (
        <div className="profile-field wide-field" key={field.key}>
          <h3>Skills</h3>
          <Tags
            label="Add a skill"
            suggestions={field.suggestions}
            value={skills.map((s) => s.name)}
            onChange={(names) =>
              update(
                field.key,
                names.map(
                  (name) =>
                    skills.find((s) => s.name === name) ?? {
                      name,
                      level: "Working",
                      mustHave: false,
                    },
                ),
              )
            }
          />
          {skills.map((skill, index) => (
            <div className="skill-detail" key={skill.name}>
              <strong>{skill.name}</strong>
              <label>
                Level
                <select
                  aria-label={`${skill.name} level`}
                  value={skill.level}
                  onChange={(event) =>
                    update(
                      field.key,
                      skills.map((s, i) =>
                        i === index ? { ...s, level: event.target.value } : s,
                      ),
                    )
                  }
                >
                  {["Strong", "Working", "Learning"].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  aria-label={`${skill.name} must-have`}
                  checked={skill.mustHave}
                  onChange={(event) =>
                    update(
                      field.key,
                      skills.map((s, i) =>
                        i === index
                          ? { ...s, mustHave: event.target.checked }
                          : s,
                      ),
                    )
                  }
                />
                Must-have in search
              </label>
            </div>
          ))}
          {errors[field.key] && (
            <p className="field-error" role="alert">
              {errors[field.key]}
            </p>
          )}
        </div>
      );
    }
    return (
      <div
        className={`profile-field ${field.kind === "textarea" || field.kind === "tags" ? "wide-field" : ""}`}
        key={field.key}
      >
        {field.kind === "tags" ? (
          <Tags
            label={field.label}
            value={value as string[]}
            suggestions={field.suggestions}
            onChange={(value) => update(field.key, value)}
          />
        ) : (
          <>
            <label
              htmlFor={id}
              className={field.kind === "checkbox" ? "checkbox-field" : ""}
            >
              {field.label}
              {field.kind === "checkbox" && (
                <input
                  id={id}
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(event) => update(field.key, event.target.checked)}
                />
              )}
            </label>
            {field.kind === "select" ? (
              <select
                id={id}
                value={String(value)}
                onChange={(event) => update(field.key, event.target.value)}
              >
                {field.options?.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            ) : field.kind === "textarea" ? (
              <textarea
                id={id}
                rows={3}
                value={String(value ?? "")}
                onChange={(event) => update(field.key, event.target.value)}
              />
            ) : field.kind !== "checkbox" ? (
              <input
                id={id}
                type={
                  field.kind === "range"
                    ? "range"
                    : field.kind === "number"
                      ? "number"
                      : field.kind === "date"
                        ? "date"
                        : "text"
                }
                min={field.kind === "range" ? 0 : undefined}
                max={field.kind === "range" ? 40 : undefined}
                step={field.kind === "range" ? 0.5 : undefined}
                value={String(value ?? "")}
                aria-invalid={Boolean(errors[field.key])}
                aria-describedby={errors[field.key] ? `${id}-error` : undefined}
                onChange={(event) =>
                  update(
                    field.key,
                    ["number", "range"].includes(field.kind ?? "")
                      ? event.target.value === ""
                        ? undefined
                        : Number(event.target.value)
                      : field.kind === "date" && !event.target.value
                        ? undefined
                        : event.target.value,
                  )
                }
                onBlur={() => validate(draft)}
                list={field.suggestions ? `${id}-options` : undefined}
              />
            ) : null}
            {field.kind === "range" && (
              <output htmlFor={id}>
                {Number(value) === 0
                  ? "Fresher / no experience"
                  : `${value} years`}
              </output>
            )}
            {field.suggestions && (
              <datalist id={`${id}-options`}>
                {field.suggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            )}
          </>
        )}
        {field.hint && <small>{field.hint}</small>}
        {errors[field.key] && (
          <p id={`${id}-error`} className="field-error" role="alert">
            {errors[field.key]}
          </p>
        )}
      </div>
    );
  };
  return (
    <form
      className="mode-profile-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = validate(draft);
        if (!parsed.success) return;
        profiles.apply(parsed.data, save);
        s.set({
          modal: null,
          toast:
            "Details applied. Your next search uses the same search budget.",
        });
      }}
    >
      <p className="modal-description">
        Every field is optional. Details stay in this tab unless you choose to
        save them with your next investigation.
      </p>
      <div className="profile-fields">{fields.main.map(render)}</div>
      {fields.more.length > 0 && (
        <details
          className="profile-more"
          open={
            s.mode === "news" && draft.timeWindow === "Custom"
              ? true
              : undefined
          }
        >
          <summary>Add more detail</summary>
          <div className="profile-fields">{fields.more.map(render)}</div>
          {s.mode === "jobs" && (
            <div className="local-resume">
              <label>
                Optional local résumé (.txt)
                <input
                  type="file"
                  accept=".txt,text/plain"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file || file.size > 500000) return;
                    const text = (await file.text()).toLowerCase();
                    setResumeSkills(
                      [
                        "Python",
                        "SQL",
                        "JavaScript",
                        "PyTorch",
                        "Excel",
                        "Communication",
                        "CUDA",
                      ].filter((skill) => text.includes(skill.toLowerCase())),
                    );
                    event.target.value = "";
                  }}
                />
              </label>
              <small>
                The file stays in your browser. Only skills you add below become
                part of your details.
              </small>
              {resumeSkills.length > 0 && (
                <div className="suggestion-chips">
                  {resumeSkills.map((name) => (
                    <button
                      type="button"
                      key={name}
                      onClick={() => {
                        const skills = draft.skills as JobsProfile["skills"];
                        if (!skills.some((s) => s.name === name))
                          update("skills", [
                            ...skills,
                            { name, level: "Working", mustHave: false },
                          ]);
                        setResumeSkills((skills) =>
                          skills.filter((s) => s !== name),
                        );
                      }}
                    >
                      Add {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </details>
      )}
      <details className="privacy-explanation">
        <summary>What is sent to models?</summary>
        <p>
          Demo stays in the browser. Live search sends this mode’s selected
          details and your question to Ollama for planning; source excerpts are
          sent for grounded answers. Role, topic, location, dates and keyword
          search terms go to SerpApi. Résumé files are never uploaded. Provider
          processing is subject to their own retention policies. Without saving,
          Cairn skips persistent checkpoints, model/source caches and the final
          investigation snapshot for this search.
        </p>
      </details>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={save}
          onChange={(event) => setSave(event.target.checked)}
        />
        Save with this investigation
      </label>
      {errors.form && (
        <p className="field-error" role="alert">
          {errors.form}
        </p>
      )}
      <div className="profile-actions">
        <button type="submit" className="primary-button">
          Apply details
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => s.set({ modal: null })}
        >
          Skip for now
        </button>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            profiles.clear();
            setDraft({ ...defaultProfile(s.mode) });
            setErrors({});
            setSave(false);
            setResumeSkills([]);
          }}
        >
          Clear my details
        </button>
      </div>
    </form>
  );
}
