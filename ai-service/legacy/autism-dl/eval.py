import os
import glob
import keras
from keras_vggface.vggface import VGGFace
from keras_vggface.utils import preprocess_input
from keras.models import load_model

Height = 224
Width  = 224
BatchSize = 32
Version = 5

baseDir   = '/home/vanitas/Desktop/Kaggle-Autism/models/eval/'
modelName = os.listdir(baseDir)
fullPath  = os.path.join(baseDir, modelName[0])

TrainPath = '/home/vanitas/Desktop/Kaggle-Autism/data/train'
ValidPath = '/home/vanitas/Desktop/Kaggle-Autism/data/valid'
TestPath  = '/home/vanitas/Desktop/Kaggle-Autism/data/test'

print("Loading:", fullPath)
model = load_model(fullPath)

def preprocess_input_new(x):
    img = preprocess_input(keras.preprocessing.image.img_to_array(x), version = 2)
    return keras.preprocessing.image.array_to_img(img)

ValidGen = keras.preprocessing.image.ImageDataGenerator(
        preprocessing_function=preprocess_input_new).flow_from_directory(
        TestPath,
        target_size=(Height, Width),
        batch_size=BatchSize,
        shuffle=False)

results = model.evaluate_generator(ValidGen, verbose=0)
print(results)
