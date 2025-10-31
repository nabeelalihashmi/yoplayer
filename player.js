const canvas = new fabric.Canvas('canvas', {
    width: projectData.canvasWidth || 800,
    height: projectData.canvasHeight || 600,
    backgroundColor: projectData.canvasBackground || '#ffffff'
});

// Track running intervals/timeouts for cleanup
let projectScriptTimers = [];
let isCanvasFullscreen = false;

// Override setTimeout/setInterval to track them
const originalSetTimeout = window.setTimeout;
const originalSetInterval = window.setInterval;

window.setTimeoutTracked = function (...args) {
    const id = originalSetTimeout.apply(window, args);
    projectScriptTimers.push(id);
    return id;
};

window.setIntervalTracked = function (...args) {
    const id = originalSetInterval.apply(window, args);
    projectScriptTimers.push(id);
    return id;
};
document.addEventListener('DOMContentLoaded', () => {
    const projectData = JSON.parse(document.getElementById('projectData').textContent);


    canvas.loadFromJSON(projectData.canvas, () => {
        canvas.renderAll();

        const animState = {
            active: true,
            playing: false,
            currentFrame: 1,
            totalFrames: projectData.animation?.totalFrames || 30,
            fps: projectData.animation?.fps || 12,
            data: projectData.animation?.data || {},
        };

        function goToFrame(frameNum) {
            frameNum = Math.max(1, Math.min(animState.totalFrames, parseInt(frameNum) || 1));
            animState.currentFrame = frameNum;

            canvas.getObjects().forEach(obj => {
                const objId = obj.animId;
                const objData = animState.data[objId];

                if (!objData || Object.keys(objData).length === 0) return;

                const frames = Object.keys(objData).map(Number).sort((a, b) => a - b);

                if (objData[frameNum]) {
                    applyPropsToObject(obj, objData[frameNum].props);
                    return;
                }

                let prevFrame = null;
                let nextFrame = null;

                for (const f of frames) {
                    if (f < frameNum) prevFrame = f;
                    if (f > frameNum && nextFrame === null) nextFrame = f;
                }

                if (prevFrame !== null && nextFrame !== null) {
                    const progress = (frameNum - prevFrame) / (nextFrame - prevFrame);
                    const interpolated = interpolateProperties(objData[prevFrame], objData[nextFrame], progress);
                    applyPropsToObject(obj, interpolated);
                } else if (prevFrame !== null) {
                    applyPropsToObject(obj, objData[prevFrame].props);
                } else if (nextFrame !== null) {
                    applyPropsToObject(obj, objData[nextFrame].props);
                }
            });

            canvas.renderAll();
        }

        function animPlay() {
            if (animState.playing) return;
            animState.playing = true;

            const frameTime = 1000 / animState.fps;

            function playNextFrame() {
                if (!animState.playing) return;

                let nextFrame = animState.currentFrame + 1;
                if (nextFrame > animState.totalFrames) {
                    nextFrame = 1;
                }

                goToFrame(nextFrame);

                if (animState.playing) {
                    setTimeout(playNextFrame, frameTime);
                }
            }

            playNextFrame();
        }

        if (projectData.projectScript) {
            try {
                const scriptFunction = new Function(projectData.projectScript);
                scriptFunction.call(window);
            } catch (e) {
                console.error('Error executing project script:', e);
            }
        }

        animPlay();
    });
});

function applyPropsToObject(obj, props) {
    // Simplified version of applyPropsToObject from the main script
    obj.set(props);
}

function interpolateProperties(startFrame, endFrame, progress) {
    // Simplified version of interpolateProperties from the main script
    const startProps = startFrame.props;
    const endProps = endFrame.props;
    const interpolated = {};

    for (const key in endProps) {
        const start = startProps[key];
        const end = endProps[key];

        if (typeof end === 'number' && typeof start === 'number') {
            interpolated[key] = start + (end - start) * progress;
        } else {
            interpolated[key] = progress > 0.5 ? end : start;
        }
    }

    return interpolated;
}



function getObjectById(id) {
    if (!id) return null;
    return canvas.getObjects().find(obj => obj.customId === id) || null;
}

// Helper function - get multiple objects by IDs
function getObjectsByIds(ids) {
    if (!Array.isArray(ids)) return [];
    return ids.map(id => getObjectById(id)).filter(obj => obj !== null);
}


function objectHasClass(obj, className) {
    return obj && obj.customClasses && obj.customClasses.includes(className);
}

// Get all objects with specific class
function getObjectsByClass(className) {
    if (!className) return [];
    return canvas.getObjects().filter(obj => objectHasClass(obj, className));
}

// Get all objects with ANY of the classes
function getObjectsByClasses(classNames) {
    if (!Array.isArray(classNames)) return [];
    return canvas.getObjects().filter(obj =>
        obj.customClasses && obj.customClasses.some(c => classNames.includes(c))
    );
}

// Get all objects with ALL of the classes
function getObjectsByAllClasses(classNames) {
    if (!Array.isArray(classNames)) return [];
    return canvas.getObjects().filter(obj =>
        obj.customClasses && classNames.every(c => obj.customClasses.includes(c))
    );
}