# Coverage: group `nn` (file `l_nn.py`; lessons `perceptron`, `mlp`)

Slide numbers are the decks' own. Step ids are those of the lesson named in the first column.

## Deck 13, The perceptron (`comp90049-perceptron`)

| Slide(s) | Knowledge / exam point | Step |
|---|---|---|
| 4 | Recap: NB generative, LR discriminative, perceptron = no probabilities, minimise error directly | `place` |
| 5-8 | Biological inspiration; neuron as processing element; network = elements converting weighted sum through an activation; topology + weights = training | `place` |
| 9-10 | 1943 McCulloch-Pitts (threshold, hand-set weights); 1958 Rosenblatt (learns weights); 1969 Minsky-Papert, AI winter, networks overcome it | `place` |
| 12-14 | Artificial neuron: input $(1, x_1..x_d)$, weights, activation $f$ as hyper-parameter, $\theta$ parameters, $y = f(\theta\cdot x)$ | `neuron` |
| 13, 15-16 | Step activation, output in {-1, 1}; $\theta\cdot x = 0$ is the decision boundary (linear); 2-D picture | `step`, quiz in `step` |
| 18-20 | Idea of the learning rule (four cases), mistake iff $y(\theta\cdot x) \le 0$; why not count errors directly | `rule`, `loss_idea` |
| 21-22 | Training algorithm: init, epochs, examples, update $\theta^{(k+1)} = \theta^{(k)} + \eta y x$, $k$ counts updates, $\le$ vs $<$, $\eta$ learning rate | `algorithm`, `rule` |
| 24-37 | Worked example 1 (four instances, $\eta = 1$, $\theta^{(0)} = 0$), epoch by epoch to convergence: $[0,0,0] \to [1,1,1] \to [0,1,1] \to [-1,1,1]$ | `ex1` (full table), `ex1_updates`, `cp_trace` |
| 39-47 | Worked example 2 ($\eta = 0.1$, $\theta = (-0.1, 0.2, 0)$, boundary moves $x_1 = 0.5 \to x_2 = x_1 - 2 \to x_1 = 1/3$); "eventually all correctly classified if separable" (slide 46 gives no coordinates for the 4th point, so the lesson stops at the third) | `ex2` |
| 49 | Convergence guaranteed for separable data; depends on init and learning rate; no max-margin guarantee (vs SVM); no guarantee when non-separable | `separable`, `theorem`, `cp_margin` |
| 50 | Perceptron rule vs gradient descent: non-differentiable (derivative at zero undefined) vs differentiable | `loss_idea`, `sgd` |
| 51 | Single sigmoid neuron with cross-entropy = logistic regression | `compare` |
| 52 | Online vs batch learning; SGD as the online version of gradient descent | `algorithm`, `sgd` |
| (Lec. 14 s. 17-19, 20) | AND, OR, XOR as perceptron problems; XOR not linearly separable | `xor`, `xor_proof`, `xor_run`, `cp_xor` |
| (exam style) | Comparison perceptron / logistic regression / SVM | `compare`, `cp_compare`, `remember` |

Deeper (beyond the deck): the rule as SGD on $\max(0, -y\theta^\top x)$ (`loss_idea`, `sgd`); scale invariance of $\eta$ from a zero start (`eta`); Novikoff's theorem and proof, mistake bound $(R/\gamma)^2$ (`theorem`, `novikoff`, `cp_bound`); why XOR never converges, weights cycle back to zero (`xor_run`); non-convergence does not prove non-separability (quiz in `xor_run`).

## Deck 14, Neural networks (`comp90049-mlp`)

| Slide(s) | Knowledge / exam point | Step |
|---|---|---|
| 3 | Recap: perceptron (step, non-differentiable) vs logistic regression (sigmoid, differentiable) | `why`, `activations` |
| 5-6 | "Stack more layers"; a NN is a combination of units; units need continuous activations | `why` |
| 7-9 | Input, output, hidden layers (units $x$, $y$, $h$); one output unit per output | `layers` |
| 10 | MLP: feed-forward, fully connected, supervised; other NN types (CNN, RNN, autoencoder) | `why` |
| 11 | Linear (perceptron, NB, LR) vs non-linear classification (NN with >= 1 hidden layer and non-linear activation); feature interactions | `why`, `collapse`, `cp_linear` |
| 12 | Historical note, why popular around 2010 (algorithms, GPU, data) | `why` |
| 14 | Terminology: depth $L$, width $K_l$, weights $\theta_{ij}^{(l)}$ with bias, activation $\phi^{(l)}$ | `layers` |
| 15-16 | Forward pass, element-wise and vectorised | `forward`, `forward_hand`, `cp_forward` |
| 17-19 | Boolean toys AND, OR, XOR: perceptron? MLP? | `xor_net`, `xor_check`, `xor` (lesson 1) |
| 20 | MLP for XOR with explicit weights ($-0.5$; $-1.5$; $1, -1, -0.5$; step $\ge 0$), checked | `xor_net`, `xor_check` |
| 21-30 | Feature engineering vs feature learning, representation learning, weather example, face recognition | `features` |
| 32-33 | Input representations (1-hot, embeddings, pixels); depth vs width; CNN/RNN/attention out of scope | `features` |
| 34 | Activations sigmoid, tanh, ReLU; "what about the step function?" | `activations`, `cp_step` |
| 35 | Output functions: step/sigmoid (binary), softmax ($K$ classes), identity (regression) | `output`, `cp_softmax` |
| 36-37 | Losses: cross-entropy (binary, multiclass, one-hot), MSE | `loss` |
| 38 | Perceptron algorithm cannot train hidden layers (no labels for hidden units); backprop = gradient descent + chain rule | `bridge`, `cp_why_not` |
| 40 | Universal approximation (single hidden layer, finitely many neurons, non-linear activations) | `power` |
| 41 | When is linear classification enough (separable, high-dim, small data, interpretability) | `proscons`, `cp_design` |
| 43 | Pros and cons of neural networks | `proscons` |

Deeper (beyond the deck): derivative of the sigmoid line by line, $\sigma' \le 1/4$ (`sigmoid_deriv`); $W_2(W_1 x) = (W_2 W_1)x$ with numbers and with biases (`collapse`); hidden space picture of XOR (`xor_net`); what universal approximation does not promise (`power`); vanishing gradients, $(1/4)^L$, ReLU slope 1, dead units (`vanish`); parameter counting (`layers`); numeric softmax and loss examples (`output`, `loss`); full numeric forward pass (`forward_hand`).

## Notes and doubts

- The deck's tanh formula is $(e^{2x}-1)/(e^{2x}+1)$ (slide 34); the lesson also gives $\tanh z = 2\sigma(2z) - 1$ (checked numerically).
- Slides 36-37 write the losses with sums (cross-entropy) and $1/N$ (MSE); the lesson follows them. Natural logs in the NN losses; the README's log base 2 applies to entropy.
- Slide 20's step is $\phi(x) = 1$ for $x \ge 0$ (the perceptron slides use $> 0$); the lesson keeps each deck's convention and says so.
- Textbook sources: Rosenblatt 1958; Minsky and Papert 1969; Novikoff 1962 (convergence theorem); Bishop PRML section 4.1.7 and Chapter 5; Cybenko 1989 and Hornik 1991 (universal approximation); Goodfellow, Bengio and Courville, *Deep Learning*, Chapter 6 (activations, vanishing gradients).
- Unsure / not covered: slide 46's fourth point of example 2 has no coordinates in the deck, so example 2 is traced for the three points whose coordinates are given. Slides 5-6 pictures (neuron anatomy, "Stack Moar Layers") are images only.
