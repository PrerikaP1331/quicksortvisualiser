document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const arrayInput = document.getElementById('array-input');
    const pivotStrategySelect = document.getElementById('pivot-strategy');
    const startSortButton = document.getElementById('start-sort');
    const nextStepButton = document.getElementById('next-step');
    const autoPlayButton = document.getElementById('auto-play');
    const resetButton = document.getElementById('reset');

    const arrayContainer = document.getElementById('array-container');
    const statusMessage = document.getElementById('status-message');

    const recursionTreeContainer = document.getElementById('recursion-tree-container');
    const recursionDepthSpan = document.getElementById('recursion-depth');
    const functionCallsSpan = document.getElementById('function-calls');
    const currentPivotImpactP = document.getElementById('current-pivot-impact');

    // Quiz Elements
    const quizQuestionDiv = document.getElementById('quiz-question');
    const quizOptionsDiv = document.getElementById('quiz-options');
    const submitAnswerButton = document.getElementById('submit-answer');
    const quizFeedbackDiv = document.getElementById('quiz-feedback');

    // State Variables
    let originalArray = [];
    let workingArray = [];
    let animationSteps = [];
    let currentStepIndex = 0;
    let autoPlayInterval = null;
    let autoPlaySpeed = 800; // ms

    let functionCalls = 0;
    let maxRecursionDepth = 0;
    let currentRecursionTreeRoot = null;

    // --- Helper Functions ---

    function displayArray(arrToDisplay = workingArray, highlights = {}) {
        arrayContainer.innerHTML = '';
        if (!arrToDisplay) {
            // console.warn("displayArray called with null/undefined arrToDisplay");
            return;
        }
        if (arrToDisplay.length === 0) {
            // console.log("displayArray: No array or empty array to display.");
            arrayContainer.innerHTML = '<div>(Array is empty)</div>'; // Visual feedback for empty array
            return;
        }

        const valuesOnly = arrToDisplay.map(item => (typeof item === 'object' ? item.value : item));
        if (valuesOnly.some(val => typeof val !== 'number' || isNaN(val))) {
            console.error("displayArray: Array contains non-numeric or NaN values:", arrToDisplay);
            arrayContainer.innerHTML = '<div>Error: Array contains invalid data.</div>';
            return;
        }

        // Determine a sensible maxValue for scaling bar heights
        // This handles all-zero, all-negative, mixed arrays.
        let visualScalingMax = 1; // Default to 1 to avoid division by zero if all values are <= 0 or array is empty
        if (valuesOnly.length > 0) {
            const maxInArray = Math.max(...valuesOnly);
            if (maxInArray > 0) {
                visualScalingMax = maxInArray;
            } else {
                // If all values are <= 0, we still use 1 to give them a base height without scaling.
                // Or, you could scale based on Math.abs(Math.min(...valuesOnly)) if you want negative bars to have proportional height.
                // For this visualizer, let's keep it simple: positive values scale, others get base height.
            }
        }


        arrToDisplay.forEach((item, index) => {
            const value = (typeof item === 'object' ? item.value : item);
            const elementDiv = document.createElement('div');
            elementDiv.classList.add('array-element');
            elementDiv.textContent = value;

            let barHeightRatio = 0;
            if (value > 0 && visualScalingMax > 0) {
                barHeightRatio = value / visualScalingMax;
            }

            const minElementHeight = 20; // px, ensures text is visible
            const scalableHeightRange = 80; // px, additional height based on value ratio

            elementDiv.style.height = `${minElementHeight + (barHeightRatio * scalableHeightRange)}px`;

            // Apply highlights
            if (highlights.pivot === index) elementDiv.classList.add('pivot');
            if (highlights.comparing && highlights.comparing.includes(index)) elementDiv.classList.add('comparing');
            if (highlights.swapping && highlights.swapping.includes(index)) elementDiv.classList.add('swapping');
            if (highlights.subArray && typeof highlights.subArray.low === 'number' && typeof highlights.subArray.high === 'number' &&
                index >= highlights.subArray.low && index <= highlights.subArray.high) {
                elementDiv.classList.add('sub-array');
            }
            if (highlights.sortedPartition && highlights.sortedPartition.includes(index)) {
                elementDiv.classList.add('sorted-partition');
            }
            arrayContainer.appendChild(elementDiv);
        });
    }

    function updateStatus(message) {
        statusMessage.textContent = `Status: ${message}`;
    }

    function resetVisualization() {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
        originalArray = [];
        workingArray = [];
        animationSteps = [];
        currentStepIndex = 0;
        functionCalls = 0;
        maxRecursionDepth = 0;
        currentRecursionTreeRoot = null;

        arrayInput.value = '';
        arrayContainer.innerHTML = '';
        recursionTreeContainer.innerHTML = '';
        updateStatus('Waiting for input...');
        recursionDepthSpan.textContent = '0';
        functionCallsSpan.textContent = '0';
        startSortButton.disabled = false;
        nextStepButton.disabled = true;
        autoPlayButton.disabled = true;
        autoPlayButton.textContent = 'Auto Play';
        currentPivotImpactP.textContent = 'Select a pivot strategy to see its potential impact.';
        resetQuiz();
    }

    // --- Event Listeners ---
    startSortButton.addEventListener('click', () => {
        const inputText = arrayInput.value.trim();
        if (!inputText) {
            alert('Please enter an array of numbers.');
            return;
        }
        originalArray = inputText.split(',')
            .map(numStr => parseInt(numStr.trim(), 10))
            .filter(num => !isNaN(num));

        if (originalArray.length === 0) {
            alert('Invalid input or no numbers entered. Please enter comma-separated numbers.');
            return;
        }

        // Call resetVisualization *before* setting new originalArray/workingArray if you want
        // to keep them for the reset call itself. Or ensure reset clears everything.
        // The current resetVisualization clears these, so it's fine.
        resetVisualization();

        // Set up for the new sort
        originalArray = inputText.split(',') // Re-parse because resetVisualization clears it
            .map(numStr => parseInt(numStr.trim(), 10))
            .filter(num => !isNaN(num));
        workingArray = originalArray.slice();


        updateStatus('Initializing Quick Sort...');
        prepareQuickSort(); // This will populate animationSteps and the recursion tree structure

        startSortButton.disabled = true;
        if (animationSteps.length > 0) {
            nextStepButton.disabled = false;
            autoPlayButton.disabled = false;
        } else { // e.g. empty or single element array might have very few steps
            nextStepButton.disabled = true;
            autoPlayButton.disabled = true;
        }

        displayArray(workingArray); // Display initial state of the array to be sorted
    });

    nextStepButton.addEventListener('click', () => {
        executeNextStep();
    });

    autoPlayButton.addEventListener('click', () => {
        if (autoPlayInterval) {
            clearInterval(autoPlayInterval);
            autoPlayInterval = null;
            autoPlayButton.textContent = 'Auto Play';
            if (currentStepIndex < animationSteps.length) { // Only update if not finished
                updateStatus('Auto play paused.');
            }
        } else {
            autoPlayButton.textContent = 'Pause';
            updateStatus('Auto playing...');
            executeNextStep(); // Execute one step immediately
            if (currentStepIndex < animationSteps.length) { // Check if more steps exist
                autoPlayInterval = setInterval(executeNextStep, autoPlaySpeed);
            } else {
                autoPlayButton.textContent = 'Auto Play'; // Already finished
            }
        }
    });

    resetButton.addEventListener('click', resetVisualization);

    pivotStrategySelect.addEventListener('change', () => {
        const strategy = pivotStrategySelect.value;
        // ... (pivot impact messages remain the same)
        if (strategy === "medianOfThree") {
            currentPivotImpactP.textContent = "Median-of-Three: Good for avoiding worst-case on sorted/nearly sorted data. Adds slight overhead.";
        } else if (strategy === "random") {
            currentPivotImpactP.textContent = "Random Pivot: Generally good performance, makes worst-case unlikely but still possible.";
        } else if (strategy === "first" || strategy === "last") {
            currentPivotImpactP.textContent = `Using ${strategy} element: Simple, but prone to O(n^2) on sorted or reverse-sorted arrays.`;
        } else if (strategy === "middle") {
            currentPivotImpactP.textContent = "Middle Element: Better than first/last for sorted data, but can still hit worst-cases.";
        }
    });


    // --- Quick Sort Core Logic (modified for visualization) ---

    function prepareQuickSort() {
        animationSteps = [];
        functionCalls = 0;
        maxRecursionDepth = 0;

        const arrayForSorting = workingArray.slice(); // Use a copy for step generation

        currentRecursionTreeRoot = {
            id: `call-${functionCalls}`,
            label: `T(${arrayForSorting.length})`,
            low: 0,
            high: arrayForSorting.length - 1,
            depth: 0,
            cost: arrayForSorting.length,
            children: []
        };

        quickSortRecursive(arrayForSorting, 0, arrayForSorting.length - 1, 0, currentRecursionTreeRoot);

        // Add the final sorted state to the 'sort_complete' step if array was modified
        let finalArrayState = workingArray.slice(); // Default to initial if no sorting happened
        if (animationSteps.length > 0) {
            // Find the last step that had an arrayState, which should be the sorted one
            for (let i = animationSteps.length - 1; i >= 0; i--) {
                if (animationSteps[i].arrayState) {
                    finalArrayState = animationSteps[i].arrayState;
                    break;
                }
            }
        }
        animationSteps.push({ type: 'sort_complete', message: 'Array Sorted!', arrayState: finalArrayState });

        updateStatus(`Ready to visualize ${animationSteps.length} steps.`);
        recursionDepthSpan.textContent = maxRecursionDepth;
        functionCallsSpan.textContent = functionCalls;
        renderRecursionTree(currentRecursionTreeRoot, recursionTreeContainer);
    }

    function quickSortRecursive(arr, low, high, depth, parentTreeNode) {
        functionCalls++;
        maxRecursionDepth = Math.max(maxRecursionDepth, depth);

        animationSteps.push({
            type: 'recursive_call_start',
            low, high, depth,
            arrayState: arr.slice(),
            treeNodeId: parentTreeNode.id
        });

        if (low < high) {
            const partitionResult = partition(arr, low, high, parentTreeNode);
            const pi = partitionResult.pivotIndex;

            const leftSize = pi - low;
            const rightSize = high - pi;

            const leftChildTreeNode = (pi - 1 >= low) ? {
                id: `call-${functionCalls}`,
                label: `T(${leftSize})`,
                low: low, high: pi - 1,
                depth: depth + 1,
                cost: leftSize,
                children: []
            } : null;
            if (leftChildTreeNode) parentTreeNode.children.push(leftChildTreeNode);

            const rightChildTreeNode = (pi + 1 <= high) ? {
                id: `call-${functionCalls + (leftChildTreeNode ? 1 : 0)}`,
                label: `T(${rightSize})`,
                low: pi + 1, high: high,
                depth: depth + 1,
                cost: rightSize,
                children: []
            } : null;
            if (rightChildTreeNode) parentTreeNode.children.push(rightChildTreeNode);

            if (leftChildTreeNode) {
                quickSortRecursive(arr, low, pi - 1, depth + 1, leftChildTreeNode);
            }
            if (rightChildTreeNode) {
                quickSortRecursive(arr, pi + 1, high, depth + 1, rightChildTreeNode);
            }

            let sortedIndicesInPartition = [];
            for (let k = low; k <= high; k++) sortedIndicesInPartition.push(k);
            animationSteps.push({
                type: 'partition_complete',
                low, high,
                pivotFinalIndex: pi,
                sortedIndices: sortedIndicesInPartition,
                arrayState: arr.slice()
            });

        } else if (low === high && low >= 0 && low < arr.length) { // Single element is "sorted" in its partition
            animationSteps.push({
                type: 'partition_complete',
                low, high,
                pivotFinalIndex: low,
                sortedIndices: [low],
                arrayState: arr.slice()
            });
        }
        animationSteps.push({ type: 'recursive_call_end', low, high, treeNodeId: parentTreeNode.id, arrayState: arr.slice() });
    }

    function partition(arr, low, high, currentTreeNode) {
        const pivotStrategy = pivotStrategySelect.value;
        let pivotIndex;
        let pivotValue;

        animationSteps.push({ type: 'status_update', message: `Partitioning arr[${low}..${high}]. Strategy: ${pivotStrategy}`, low, high, arrayState: arr.slice() });

        if (pivotStrategy === 'first') {
            pivotIndex = low;
        } else if (pivotStrategy === 'last') {
            pivotIndex = high;
        } else if (pivotStrategy === 'random') {
            pivotIndex = Math.floor(Math.random() * (high - low + 1)) + low;
        } else if (pivotStrategy === 'middle') {
            pivotIndex = Math.floor((low + high) / 2);
        } else if (pivotStrategy === 'medianOfThree') {
            if (high - low + 1 < 3) {
                pivotIndex = low;
            } else {
                const mid = Math.floor((low + high) / 2);
                animationSteps.push({ type: 'compare_pivot_candidates', indices: [low, mid, high], low, high, arrayState: arr.slice() });
                // Simplified: find median of arr[low], arr[mid], arr[high]
                const candidates = [{ val: arr[low], idx: low }, { val: arr[mid], idx: mid }, { val: arr[high], idx: high }];
                candidates.sort((a, b) => a.val - b.val);
                pivotIndex = candidates[1].idx; // Index of the median value
            }
        }
        pivotValue = arr[pivotIndex];
        animationSteps.push({ type: 'pivot_selected', index: pivotIndex, value: pivotValue, low, high, arrayState: arr.slice() });

        if (pivotIndex !== high) { // Move pivot to end for Lomuto-like partitioning
            animationSteps.push({ type: 'swap_details', indices: [pivotIndex, high], arrayState: arr.slice(), message: `Moving pivot ${arr[pivotIndex]} to end.` });
            [arr[pivotIndex], arr[high]] = [arr[high], arr[pivotIndex]];
            animationSteps.push({ type: 'after_swap', arrayState: arr.slice(), low, high });
        }
        pivotValue = arr[high];

        let i = low - 1;

        for (let j = low; j < high; j++) {
            animationSteps.push({ type: 'compare', indices: [j, high], low, high, arrayState: arr.slice() });
            if (arr[j] < pivotValue) {
                i++;
                if (i !== j) {
                    animationSteps.push({ type: 'swap_details', indices: [i, j], arrayState: arr.slice(), message: `Swapping ${arr[i]} and ${arr[j]}` });
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                    animationSteps.push({ type: 'after_swap', arrayState: arr.slice(), low, high });
                }
            }
        }

        animationSteps.push({ type: 'swap_details', indices: [i + 1, high], arrayState: arr.slice(), message: `Placing pivot ${arr[high]} in correct position.` });
        [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
        const finalPivotIndex = i + 1;
        animationSteps.push({ type: 'pivot_placed', index: finalPivotIndex, low, high, arrayState: arr.slice() });

        if (currentTreeNode) {
            currentTreeNode.cost = (high - low + 1);
        }
        return { pivotIndex: finalPivotIndex };
    }

    // --- Animation Execution ---
    function executeNextStep() {
        if (currentStepIndex >= animationSteps.length) {
            updateStatus('Sorting complete!');
            if (autoPlayInterval) clearInterval(autoPlayInterval);
            autoPlayButton.textContent = 'Auto Play';
            autoPlayButton.disabled = true;
            nextStepButton.disabled = true;
            // Display final sorted array if workingArray is populated
            if (workingArray && workingArray.length > 0) {
                displayArray(workingArray, { sortedPartition: workingArray.map((_, idx) => idx) });
            }
            return;
        }

        const step = animationSteps[currentStepIndex];
        let highlights = {};
        // Always use the arrayState from the step for display consistency.
        // The global workingArray will be updated after this step if it's a state-changing step.
        let arrayToDisplay = step.arrayState ? step.arrayState.slice() : workingArray.slice();


        document.querySelectorAll('.tree-node.active-call').forEach(el => el.classList.remove('active-call'));
        if (step.treeNodeId) {
            const activeNodeEl = document.getElementById(step.treeNodeId + '-node');
            if (activeNodeEl) activeNodeEl.classList.add('active-call');
        }

        // Define subArray for highlighting if available in the step
        if (typeof step.low === 'number' && typeof step.high === 'number') {
            highlights.subArray = { low: step.low, high: step.high };
        }

        switch (step.type) {
            case 'status_update':
                updateStatus(step.message);
                break;
            case 'pivot_selected':
                updateStatus(`Pivot selected: ${step.value} (index ${step.index}) for arr[${step.low}..${step.high}]`);
                highlights.pivot = step.index; // Original index of pivot before potential move
                // If pivot was moved to high for partitioning, highlight arr[high] during partition
                // For this step, highlight its original position.
                break;
            case 'compare_pivot_candidates':
                updateStatus(`Comparing median-of-three candidates: ${step.indices.map(i => arrayToDisplay[i]).join(', ')}`);
                highlights.comparing = step.indices;
                break;
            case 'compare':
                updateStatus(`Comparing ${arrayToDisplay[step.indices[0]]} with pivot ${arrayToDisplay[step.indices[1]]}`);
                highlights.comparing = [step.indices[0]]; // Element being compared
                highlights.pivot = step.indices[1]; // Pivot element (usually at 'high' end during Lomuto)
                break;
            case 'swap_details':
                updateStatus(step.message || `Swapping elements at indices ${step.indices[0]} and ${step.indices[1]}`);
                highlights.swapping = step.indices;
                break;
            case 'after_swap':
                updateStatus('Swap complete.');
                // Display is based on step.arrayState which is *after* the swap
                break;
            case 'pivot_placed':
                updateStatus(`Pivot ${arrayToDisplay[step.index]} placed at index ${step.index}.`);
                highlights.pivot = step.index;
                highlights.sortedPartition = [step.index]; // Mark pivot as "locally" sorted
                break;
            case 'recursive_call_start':
                updateStatus(`Recursive call for arr[${step.low}..${step.high}], depth ${step.depth}`);
                // subArray highlight already set
                break;
            case 'recursive_call_end':
                updateStatus(`Returning from call for arr[${step.low}..${step.high}]`);
                break;
            case 'partition_complete':
                updateStatus(`Partition arr[${step.low}..${step.high}] complete. Pivot at ${step.pivotFinalIndex}.`);
                highlights.sortedPartition = step.sortedIndices;
                highlights.pivot = step.pivotFinalIndex;
                break;
            case 'sort_complete':
                updateStatus(step.message);
                highlights.sortedPartition = arrayToDisplay.map((_, idx) => idx); // All sorted
                if (autoPlayInterval) clearInterval(autoPlayInterval);
                autoPlayButton.textContent = 'Auto Play';
                autoPlayButton.disabled = true;
                nextStepButton.disabled = true;
                break;
        }

        displayArray(arrayToDisplay, highlights);

        // Update global workingArray to reflect the state shown in this step
        // This is important for the final 'sort_complete' display and if user pauses.
        if (step.arrayState) {
            workingArray = step.arrayState.slice();
        }

        currentStepIndex++;
        if (currentStepIndex >= animationSteps.length) {
            if (autoPlayInterval) clearInterval(autoPlayInterval);
            autoPlayButton.textContent = 'Auto Play';
            autoPlayButton.disabled = true;
            nextStepButton.disabled = true;
            // Final status already set by 'sort_complete' or if loop finishes here
        }
    }

    // --- Recursion Tree Display ---
    function renderRecursionTree(node, containerElement) {
        containerElement.innerHTML = '';
        if (!node) return;

        const treeRootUl = document.createElement('ul');
        treeRootUl.style.listStyleType = 'none';
        treeRootUl.style.paddingLeft = '0';

        buildTreeDOM(node, treeRootUl);
        containerElement.appendChild(treeRootUl);
    }

    function buildTreeDOM(treeNode, parentUlElement) {
        if (!treeNode || (typeof treeNode.cost === 'number' && treeNode.cost <= 0 && treeNode.label !== `T(0)` && treeNode.label !== `T(1)`)) {
            // Don't render T(0) nodes explicitly unless it's the root of a very small array.
            // Allow T(1) as it's a base case that does exist.
            // Cost check is primary.
            if (treeNode.label === 'T(0)') return; // Usually don't show T(0)
        }


        const listItem = document.createElement('li');
        listItem.classList.add('tree-node');
        listItem.id = treeNode.id + '-node';

        const nodeLabel = document.createElement('span');
        nodeLabel.classList.add('node-label');
        nodeLabel.textContent = `${treeNode.label}`;
        if (typeof treeNode.cost === 'number' && treeNode.cost > 0) {
            nodeLabel.textContent += ` (cost: ${treeNode.cost})`;
        }
        listItem.appendChild(nodeLabel);

        const rangeSpan = document.createElement('span');
        rangeSpan.textContent = ` [${treeNode.low}-${treeNode.high}]`;
        rangeSpan.style.fontSize = '0.8em';
        rangeSpan.style.color = '#555';
        listItem.appendChild(rangeSpan);

        parentUlElement.appendChild(listItem);

        if (treeNode.children && treeNode.children.length > 0) {
            const childrenUl = document.createElement('ul');
            childrenUl.style.listStyleType = 'none';
            childrenUl.style.paddingLeft = '20px';
            treeNode.children.forEach(childNode => {
                if (childNode.cost > 0 || childNode.label === 'T(1)') { // Filter out T(0) children here too
                    buildTreeDOM(childNode, childrenUl);
                }
            });
            if (childrenUl.hasChildNodes()) {
                listItem.appendChild(childrenUl);
            }
        }
    }


    // --- Quiz Mode ---
    const quizData = [
        // ... (quizData remains the same)
        {
            question: "What is the worst-case time complexity of Quick Sort?",
            options: ["O(n log n)", "O(n)", "O(n^2)", "O(log n)"],
            answer: "O(n^2)"
        },
        {
            question: "When does the worst-case for Quick Sort typically occur?",
            options: ["When the array is random", "When the pivot always picks the smallest or largest element", "When the array is already sorted (using first/last element as pivot)", "Both B and C"],
            answer: "Both B and C"
        },
        {
            question: "What is the average-case time complexity of Quick Sort?",
            options: ["O(n^2)", "O(n log n)", "O(n)", "O(1)"],
            answer: "O(n log n)"
        },
        {
            question: "Which pivot strategy is generally good at avoiding worst-case scenarios?",
            options: ["Always first element", "Always last element", "Random pivot or Median-of-three", "Always middle element"],
            answer: "Random pivot or Median-of-three"
        },
        {
            question: "Is Quick Sort a stable sorting algorithm?",
            options: ["Yes", "No"],
            answer: "No"
        }
    ];
    let currentQuizQuestionIndex = -1;
    let score = 0;

    function loadQuizQuestion() {
        currentQuizQuestionIndex++;
        if (currentQuizQuestionIndex >= quizData.length) {
            quizQuestionDiv.textContent = `Quiz Finished! Your score: ${score}/${quizData.length}`;
            quizOptionsDiv.innerHTML = '';
            submitAnswerButton.style.display = 'none';
            quizFeedbackDiv.textContent = '';
            const restartQuizButton = document.createElement('button');
            restartQuizButton.textContent = 'Restart Quiz';
            restartQuizButton.onclick = () => { currentQuizQuestionIndex = -1; score = 0; submitAnswerButton.style.display = 'inline-block'; loadQuizQuestion(); };
            quizOptionsDiv.appendChild(restartQuizButton);
            return;
        }

        const q = quizData[currentQuizQuestionIndex];
        quizQuestionDiv.textContent = q.question;
        quizOptionsDiv.innerHTML = '';
        q.options.forEach(option => {
            const button = document.createElement('button');
            button.textContent = option;
            button.onclick = () => {
                quizOptionsDiv.querySelectorAll('button').forEach(btn => {
                    btn.style.backgroundColor = '#f0f0f0';
                    delete btn.dataset.selected;
                });
                button.style.backgroundColor = '#a0c4ff';
                button.dataset.selected = "true";
            };
            quizOptionsDiv.appendChild(button);
        });
        submitAnswerButton.style.display = 'inline-block';
        quizFeedbackDiv.textContent = '';
    }

    submitAnswerButton.addEventListener('click', () => {
        const selectedOptionButton = quizOptionsDiv.querySelector('button[data-selected="true"]');
        if (!selectedOptionButton) {
            quizFeedbackDiv.textContent = "Please select an answer.";
            quizFeedbackDiv.style.color = "red";
            return;
        }

        const selectedAnswer = selectedOptionButton.textContent;
        const correctAnswer = quizData[currentQuizQuestionIndex].answer;

        if (selectedAnswer === correctAnswer) {
            quizFeedbackDiv.textContent = "Correct!";
            quizFeedbackDiv.style.color = "green";
            score++;
        } else {
            quizFeedbackDiv.textContent = `Incorrect. Correct answer: ${correctAnswer}`;
            quizFeedbackDiv.style.color = "red";
        }

        selectedOptionButton.removeAttribute('data-selected');
        // Disable options after answering
        quizOptionsDiv.querySelectorAll('button').forEach(btn => btn.disabled = true);


        setTimeout(() => {
            quizOptionsDiv.querySelectorAll('button').forEach(btn => btn.disabled = false); // Re-enable for next Q
            loadQuizQuestion();
        }, 1500);
    });

    function resetQuiz() {
        currentQuizQuestionIndex = -1;
        score = 0;
        quizFeedbackDiv.textContent = '';
        quizOptionsDiv.innerHTML = ''; // Clear any old buttons like "Restart Quiz"
        submitAnswerButton.style.display = 'inline-block'; // Ensure it's visible
        loadQuizQuestion();
    }

    // Initialize
    resetVisualization();
});