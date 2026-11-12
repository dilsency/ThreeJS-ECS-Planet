// #region camera
export const EnumModeDirUpTransition = Object.freeze({
    Rigid: "Rigid",
    KeepPitch: "KeepPitch",
    KeepView: "KeepView",
    Frozen: "Frozen",
});
// #endregion camera


// #region gravity
export const EnumStateGravity = Object.freeze({
    None: "None",
    Orbit: "Orbit",
    Stratosphere: "Stratosphere",
    Falling: "Falling",
    Jumping: "Jumping",
    CrossingOver: "CrossingOver",
    Landed: "Landed",
});
// #endregion gravity

// #region hud layout
export const EnumHUDCubeHorizontalAlignment = Object.freeze({
    CENTER: "CENTER",
    LEFT: "LEFT",
    RIGHT: "RIGHT",
});
export const EnumHUDPanelYawBehavior = Object.freeze({
    MATCH_CUBE: "MATCH_CUBE",
    RECTANGULAR: "RECTANGULAR",
});

// #endregion hud layout

// #region voice
export const EnumModeVoiceTranscriber = Object.freeze({
    None: "None",
    Local: "Local",
    Cloud: "Cloud",
});
export const EnumLabelVoiceTranscriber = Object.freeze({
    None: "None",
    Local: "Local (75 MB)",
    Cloud: "Cloud",
});
export const EnumStateVoiceRecording = Object.freeze({
    Idle: "Idle",
    Opening: "Opening",
    Cancelled: "Cancelled",
    Recording: "Recording",
    TailDelay: "TailDelay",
    Finishing: "Finishing",
});
// #endregion voice