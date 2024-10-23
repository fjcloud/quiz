class QuizApp {
    constructor() {
        this.quizzes = {};
        this.currentQuiz = null;
        this.questions = [];
        this.currentQuestion = 0;
        this.userAnswers = [];
        this.setupEventListeners();
        this.loadQuizzes();
    }

    setupEventListeners() {
        document.getElementById('prevBtn').addEventListener('click', () => this.previousQuestion());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextQuestion());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartQuiz());
        document.getElementById('backToListBtn').addEventListener('click', () => this.showQuizList());
        document.getElementById('exitQuizBtn').addEventListener('click', () => this.showQuizList());
    }

    async loadQuizzes() {
        try {
            // First load the manifest
            const manifestResponse = await fetch('/data/manifest.yaml');
            if (!manifestResponse.ok) {
                throw new Error('Failed to load quiz manifest');
            }
            
            const manifestContent = await manifestResponse.text();
            const manifest = jsyaml.load(manifestContent);
            
            if (!manifest.quizzes || !Array.isArray(manifest.quizzes)) {
                throw new Error('Invalid manifest format');
            }

            // Sort quizzes by order if present
            const sortedQuizzes = [...manifest.quizzes].sort((a, b) => 
                (a.order || 0) - (b.order || 0)
            );

            // Load each quiz file listed in the manifest
            for (const quizInfo of sortedQuizzes) {
                try {
                    const fileResponse = await fetch(`/data/${quizInfo.filename}`);
                    if (fileResponse.ok) {
                        const content = await fileResponse.text();
                        const quizData = jsyaml.load(content);
                        if (this.isValidQuizData(quizData)) {
                            this.quizzes[quizInfo.filename] = quizData;
                        } else {
                            console.warn(`Invalid quiz data in ${quizInfo.filename}`);
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to load ${quizInfo.filename}:`, error);
                }
            }
            
            if (Object.keys(this.quizzes).length === 0) {
                throw new Error('No valid quiz files found');
            }
            
            this.showQuizList();
        } catch (error) {
            console.error('Error loading quizzes:', error);
            document.getElementById('loadingState').innerHTML = `
                <h1 class="text-2xl font-bold mb-4 text-red-600">Error Loading Quizzes</h1>
                <p>Please ensure manifest.yaml and quiz files are present in the /data directory.</p>
                <p class="text-sm text-gray-600 mt-2">Technical details: ${error.message}</p>
            `;
        }
    }

    isValidQuizData(data) {
        return (
            data &&
            typeof data.title === 'string' &&
            typeof data.description === 'string' &&
            Array.isArray(data.questions) &&
            data.questions.every(q => 
                q.topic &&
                q.question &&
                typeof q.correct === 'number' &&
                Array.isArray(q.choices) &&
                q.choices.length > 0
            )
        );
    }

    showQuizList() {
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('quizContainer').classList.add('hidden');
        document.getElementById('resultsContainer').classList.add('hidden');
        
        const quizSelection = document.getElementById('quizSelection');
        quizSelection.classList.remove('hidden');
        
        const quizList = document.getElementById('quizList');
        quizList.innerHTML = '';
        
        Object.entries(this.quizzes).forEach(([filename, quiz]) => {
            const button = document.createElement('button');
            button.className = 'w-full text-left p-4 bg-gray-50 hover:bg-gray-100 rounded border mb-2';
            button.innerHTML = `
                <h3 class="font-bold">${quiz.title}</h3>
                <p class="text-sm text-gray-600">${quiz.description}</p>
                <p class="text-sm text-gray-500 mt-1">${quiz.questions.length} questions</p>
            `;
            button.onclick = () => this.startQuiz(filename);
            quizList.appendChild(button);
        });
    }

    startQuiz(filename) {
        this.currentQuiz = filename;
        this.questions = this.quizzes[filename].questions;
        this.currentQuestion = 0;
        this.userAnswers = new Array(this.questions.length).fill(null);
        
        document.getElementById('quizSelection').classList.add('hidden');
        document.getElementById('resultsContainer').classList.add('hidden');
        document.getElementById('quizContainer').classList.remove('hidden');
        
        this.displayQuestion();
    }

    displayQuestion() {
        const question = this.questions[this.currentQuestion];

        document.getElementById('questionNumber').textContent = `Question ${this.currentQuestion + 1}/${this.questions.length}`;
        document.getElementById('topic').textContent = question.topic;
        document.getElementById('questionText').textContent = question.question;

        const choicesContainer = document.getElementById('choices');
        choicesContainer.innerHTML = '';

        const choicesDiv = document.createElement('div');
        choicesDiv.className = 'space-y-2';

        question.choices.forEach((choice, index) => {
            const button = document.createElement('button');
            button.className = `w-full text-left p-3 rounded ${
                this.userAnswers[this.currentQuestion] === index 
                    ? 'bg-blue-100 border-blue-500' 
                    : 'bg-gray-50 hover:bg-gray-100'
            } border`;
            button.textContent = choice;
            button.onclick = () => this.selectAnswer(index);
            choicesDiv.appendChild(button);
        });

        choicesContainer.appendChild(choicesDiv);

        const nextBtn = document.getElementById('nextBtn');
        nextBtn.textContent = this.currentQuestion === this.questions.length - 1 ? 'Finish' : 'Next';
        document.getElementById('prevBtn').disabled = this.currentQuestion === 0;
        nextBtn.disabled = this.userAnswers[this.currentQuestion] === null;
    }

    selectAnswer(index) {
        this.userAnswers[this.currentQuestion] = index;
        this.displayQuestion();
    }

    previousQuestion() {
        if (this.currentQuestion > 0) {
            this.currentQuestion--;
            this.displayQuestion();
        }
    }

    nextQuestion() {
        if (this.currentQuestion < this.questions.length - 1) {
            this.currentQuestion++;
            this.displayQuestion();
        } else {
            this.showResults();
        }
    }

    showResults() {
        document.getElementById('quizContainer').classList.add('hidden');
        document.getElementById('resultsContainer').classList.remove('hidden');

        const correctAnswers = this.userAnswers.filter((answer, index) => 
            answer === this.questions[index].correct
        ).length;

        const scorePercentage = ((correctAnswers / this.questions.length) * 100).toFixed(1);
        document.getElementById('score').textContent = 
            `Your Score: ${correctAnswers}/${this.questions.length} (${scorePercentage}%)`;

        const incorrectContainer = document.getElementById('incorrectAnswers');
        incorrectContainer.innerHTML = '<h3 class="font-bold mb-2">Incorrect Answers:</h3>';

        let hasIncorrectAnswers = false;
        this.questions.forEach((question, index) => {
            if (this.userAnswers[index] !== question.correct) {
                hasIncorrectAnswers = true;
                const div = document.createElement('div');
                div.className = 'mb-4 p-3 bg-red-50 rounded';
                div.innerHTML = `
                    <p class="font-bold">${question.question}</p>
                    <p class="text-red-600">Your answer: ${question.choices[this.userAnswers[index]]}</p>
                    <p class="text-green-600">Correct answer: ${question.choices[question.correct]}</p>
                `;
                incorrectContainer.appendChild(div);
            }
        });

        if (!hasIncorrectAnswers) {
            incorrectContainer.innerHTML = `
                <div class="p-3 bg-green-50 rounded">
                    <p class="text-green-600 font-bold">Perfect score! All answers are correct.</p>
                </div>
            `;
        }
    }

    restartQuiz() {
        this.currentQuestion = 0;
        this.userAnswers = new Array(this.questions.length).fill(null);
        document.getElementById('resultsContainer').classList.add('hidden');
        document.getElementById('quizContainer').classList.remove('hidden');
        this.displayQuestion();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new QuizApp();
});
